package com.marketplace.security;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;

@Slf4j
@Component
public class JwtUtil {

    @Value("${app.jwt.secret}")         private String secret;
    @Value("${app.jwt.access-expiry}")  private long   accessExpiry;
    @Value("${app.jwt.refresh-expiry}") private long   refreshExpiry;

    private SecretKey signingKey;

    @PostConstruct
    public void init() {
        if (secret == null || secret.isBlank())
            throw new IllegalStateException(
                    "JWT secret (JWT_SECRET) must be set via environment variable");
        if (secret.getBytes(StandardCharsets.UTF_8).length < 32)
            throw new IllegalStateException(
                    "JWT secret must be at least 32 bytes long");
        this.signingKey = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        log.info("JWT configuration loaded: accessExpiryMs={}, refreshExpiryMs={}, secretBytes={}",
                accessExpiry, refreshExpiry, secret.getBytes(StandardCharsets.UTF_8).length);
    }

    // ── Token generation ──────────────────────────────────────────────────────

    /**
     * Access token: subject = email, custom claims include userId, role, vendorId.
     */
    public String generateAccessToken(String userId, String email,
                                      String role, String vendorId) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("userId", userId);
        claims.put("role",   role);
        if (vendorId != null) claims.put("vendorId", vendorId);

        return Jwts.builder()
                .claims(claims)
                .subject(email)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + accessExpiry))
                .signWith(signingKey)
                .compact();
    }

    /**
     * Refresh token: subject = userId, no custom claims.
     * Keep it minimal — callers MUST use {@link #extractSubject} (not
     * {@link #extractUserId}) to retrieve the userId from a refresh token.
     */
    public String generateRefreshToken(String userId) {
        return Jwts.builder()
                .subject(userId)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + refreshExpiry))
                .signWith(signingKey)
                .compact();
    }

    // ── Claim extraction ──────────────────────────────────────────────────────

    public Claims extractAllClaims(String token) {
        return Jwts.parser()
                .verifyWith(signingKey).build()
                .parseSignedClaims(token).getPayload();
    }

    /**
     * Returns the JWT subject.
     * <ul>
     *   <li>Access token  → the user's email address</li>
     *   <li>Refresh token → the user's ID</li>
     * </ul>
     * Use this method when the caller already knows which token type it has.
     */
    public String extractSubject(String token) {
        return extractAllClaims(token).getSubject();
    }

    /**
     * Convenience alias for access tokens where the subject is the email.
     * Do NOT call on refresh tokens — use {@link #extractSubject} instead.
     */
    public String extractEmail(String token) {
        return extractSubject(token);
    }

    /**
     * Extracts the {@code userId} custom claim present only in access tokens.
     * Returns {@code null} for refresh tokens (they carry userId as subject,
     * not as a custom claim). Use {@link #extractSubject} for refresh tokens.
     */
    public String extractUserId(String token) {
        return extractAllClaims(token).get("userId", String.class);
    }

    public String extractRole(String token) {
        return extractAllClaims(token).get("role", String.class);
    }

    public String extractVendorId(String token) {
        return extractAllClaims(token).get("vendorId", String.class);
    }

    public boolean isTokenExpired(String token) {
        return extractAllClaims(token).getExpiration().before(new Date());
    }

    public boolean validateToken(String token) {
        try {
            extractAllClaims(token);
            return !isTokenExpired(token);
        } catch (JwtException | IllegalArgumentException e) {
            log.warn("Invalid JWT token: {}", e.getMessage());
            return false;
        }
    }
}
