package com.marketplace.security;

import jakarta.servlet.*;
import jakarta.servlet.http.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtUtil                       jwtUtil;
    private final UserDetailsServiceImpl        userDetailsService;
    private final RedisTemplate<String, Object> redisTemplate;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain)
            throws ServletException, IOException {

        String token = extractToken(request);
        boolean hasBearerToken = token != null;

        if (requiresAuthentication(request)) {
            log.debug("JWT auth check for URI {}: bearer token present={}",
                    request.getRequestURI(), hasBearerToken);
        }

        if (hasBearerToken && jwtUtil.validateToken(token)) {
            if (isTokenBlacklisted(token)) {
                log.warn("JWT auth rejected for URI {}: token is blacklisted or Redis is unavailable",
                        request.getRequestURI());
                filterChain.doFilter(request, response);
                return;
            }

            try {
                String email  = jwtUtil.extractEmail(token);
                // FIX BUG 9: read userId from JWT claim — no DB round-trip needed
                String userId = jwtUtil.extractUserId(token);
                String role   = jwtUtil.extractRole(token);

                log.debug("JWT valid for URI {}: subject={}, userIdPresent={}, role={}",
                        request.getRequestURI(), email, userId != null && !userId.isBlank(), role);

                if (email != null && SecurityContextHolder.getContext().getAuthentication() == null) {
                    UserDetails userDetails = userDetailsService.loadUserByUsername(email);
                    log.debug("UserDetails loaded for JWT subject {} with authorities {}",
                            email, userDetails.getAuthorities());

                    UsernamePasswordAuthenticationToken authToken =
                            new UsernamePasswordAuthenticationToken(
                                    userDetails, null, userDetails.getAuthorities());

                    // FIX BUG 9: stash userId in details map so SecurityUtil.currentUserId()
                    // can retrieve it without a DB hit
                    Map<String, Object> details = new HashMap<>();
                    details.put("userId",  userId != null ? userId : "");
                    details.put("request", new WebAuthenticationDetailsSource().buildDetails(request));
                    authToken.setDetails(details);

                    SecurityContextHolder.getContext().setAuthentication(authToken);
                    log.debug("SecurityContext authentication created for URI {} and subject {}",
                            request.getRequestURI(), email);
                }
            } catch (Exception e) {
                log.error("Cannot set user authentication for URI {}: {}",
                        request.getRequestURI(), e.getMessage());
            }
        } else if (hasBearerToken) {
            log.warn("JWT auth rejected for URI {}: token validation failed", request.getRequestURI());
        }
        filterChain.doFilter(request, response);
    }

    private String extractToken(HttpServletRequest request) {
        String header = request.getHeader("Authorization");
        if (StringUtils.hasText(header) && header.startsWith("Bearer "))
            return header.substring(7);
        return null;
    }

    // FIXED critical-5: fail-CLOSED on Redis errors.
    // Returning false on Redis failure silently re-validates every logged-out token
    // during an outage. Fail-closed (return true = treat as blacklisted) is the safe default:
    // worst case is a brief auth interruption, not a security bypass.
    private boolean isTokenBlacklisted(String token) {
        try {
            boolean blacklisted = Boolean.TRUE.equals(redisTemplate.hasKey("blacklist:" + token));
            log.debug("Redis JWT blacklist check completed: blacklisted={}", blacklisted);
            return blacklisted;
        } catch (Exception e) {
            log.error("Redis unavailable for blacklist check — denying token as a safety measure: {}", e.getMessage());
            return true;  // fail-closed: treat token as blacklisted when Redis is unreachable
        }
    }

    private boolean requiresAuthentication(HttpServletRequest request) {
        String uri = request.getRequestURI();
        return uri.startsWith("/api/users/")
                || uri.startsWith("/api/orders/")
                || uri.startsWith("/api/returns/")
                || uri.startsWith("/api/cart/")
                || uri.startsWith("/api/wallet/")
                || uri.startsWith("/api/vendor/")
                || uri.startsWith("/api/admin/");
    }
}
