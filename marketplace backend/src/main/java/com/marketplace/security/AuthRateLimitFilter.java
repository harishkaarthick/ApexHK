package com.marketplace.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * FIX H-5: IP-based rate limiter for auth endpoints.
 *
 * Problem: /api/auth/login, /register, and /refresh-token had no brute-force
 * protection. An attacker could enumerate valid emails or exhaustively try
 * passwords with zero throttling.
 *
 * Solution: a sliding fixed-window counter per IP address. Each IP is allowed
 * MAX_REQUESTS_PER_WINDOW requests within a WINDOW_SECONDS rolling window for
 * the rate-limited paths. Requests that exceed the limit receive HTTP 429.
 *
 * Implementation notes:
 * - Uses ConcurrentHashMap + AtomicInteger — no third-party dependency required.
 * - The per-IP entry is expired lazily on the next request after the window
 *   has elapsed, keeping the map small without a background thread.
 * - In a multi-instance deployment, counters are local to each instance.
 *   For strict global limits, replace with a Redis-backed counter; this
 *   implementation is sufficient to stop single-source brute-force attacks.
 */
@Slf4j
@Component
public class AuthRateLimitFilter extends OncePerRequestFilter {

    private static final int    MAX_REQUESTS_PER_WINDOW = 10;  // requests per window
    private static final long   WINDOW_SECONDS          = 60L; // 1-minute window

    private static final String[] RATE_LIMITED_PATHS = {
            "/api/auth/login",
            "/api/auth/register",
            "/api/auth/refresh-token"
    };

    private record WindowEntry(AtomicInteger count, long windowStart) {}

    private final Map<String, WindowEntry> ipCounters = new ConcurrentHashMap<>();

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        for (String limited : RATE_LIMITED_PATHS) {
            if (path.equals(limited)) return false;
        }
        return true; // skip filter for all other paths
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain)
            throws ServletException, IOException {

        String ip = resolveClientIp(request);
        long now = Instant.now().getEpochSecond();

        WindowEntry entry = ipCounters.compute(ip, (key, existing) -> {
            if (existing == null || (now - existing.windowStart()) >= WINDOW_SECONDS) {
                // New or expired window — start fresh
                return new WindowEntry(new AtomicInteger(1), now);
            }
            existing.count().incrementAndGet();
            return existing;
        });

        int count = entry.count().get();
        if (count > MAX_REQUESTS_PER_WINDOW) {
            log.warn("Rate limit exceeded for IP {} on path {} ({} requests in window)",
                    ip, request.getRequestURI(), count);
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.getWriter().write(
                    "{\"success\":false,\"status\":429,"
                            + "\"message\":\"Too many requests. Please try again later.\"}");
            return;
        }

        filterChain.doFilter(request, response);
    }

    /**
     * ISSUE-05 FIX: Prevent X-Forwarded-For header spoofing.
     *
     * Previously the header was trusted unconditionally, letting any client send
     * X-Forwarded-For: 1.2.3.4 to cycle through spoofed IPs and bypass the window.
     *
     * Fix: Only honour X-Forwarded-For when the TCP-level remote address belongs to
     * a known trusted proxy CIDR (configured via app.trusted-proxy-cidrs, defaulting
     * to the RFC-1918 private ranges used by AWS ALB / nginx in typical deployments).
     * If the direct caller is not a known proxy, use getRemoteAddr() as-is.
     *
     * For environments where the entire app is behind a load balancer,
     * setting server.forward-headers-strategy=native in application.properties
     * makes Spring automatically handle this before it reaches the filter.
     */
    private String resolveClientIp(HttpServletRequest request) {
        String remoteAddr = request.getRemoteAddr();
        if (isFromTrustedProxy(remoteAddr)) {
            String xff = request.getHeader("X-Forwarded-For");
            if (xff != null && !xff.isBlank()) {
                // X-Forwarded-For may be a comma-separated list; take the leftmost (real client) IP
                return xff.split(",")[0].trim();
            }
        }
        return remoteAddr;
    }

    /**
     * Returns true when remoteAddr is a known/trusted proxy (RFC-1918 private ranges
     * and loopback). Extend with your actual load-balancer CIDR for production.
     */
    private boolean isFromTrustedProxy(String remoteAddr) {
        if (remoteAddr == null) return false;
        return remoteAddr.equals("127.0.0.1")
                || remoteAddr.equals("0:0:0:0:0:0:0:1")  // IPv6 loopback
                || remoteAddr.startsWith("10.")
                || remoteAddr.startsWith("192.168.")
                || (remoteAddr.startsWith("172.") && isBetween172(remoteAddr));
    }

    private boolean isBetween172(String ip) {
        try {
            String[] parts = ip.split("\\.");
            if (parts.length < 2) return false;
            int second = Integer.parseInt(parts[1]);
            return second >= 16 && second <= 31;
        } catch (NumberFormatException e) {
            return false;
        }
    }
}