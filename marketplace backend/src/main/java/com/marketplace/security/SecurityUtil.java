package com.marketplace.security;

import com.marketplace.exception.UnauthorizedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Map;

/**
 * Resolves the current user's MongoDB document ID from the security context.
 *
 * JwtAuthFilter stores userId in the authentication details map (key "userId")
 * after extracting it from the JWT claim.  That is the only valid source.
 *
 * FIX C-2: The old code had a fallback that returned ud.getUsername(), which is
 * the user's email address — NOT a MongoDB _id.  Any service that received the
 * email where it expected an _id would silently 404 or corrupt data.  The
 * fallback has been removed; if the details map does not contain a non-blank
 * userId the method throws UnauthorizedException immediately.
 */
public final class SecurityUtil {

    private SecurityUtil() {}

    @SuppressWarnings("unchecked")
    public static String currentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated())
            throw new UnauthorizedException("Not authenticated");

        if (auth.getDetails() instanceof Map<?, ?> details) {
            Object uid = details.get("userId");
            if (uid instanceof String s && !s.isBlank()) return s;
        }

        // FIX C-2: Do NOT fall through to ud.getUsername() — that returns the email,
        // not the MongoDB _id.  Fail loudly so the misconfiguration is visible
        // immediately rather than producing silent data-corruption downstream.
        throw new UnauthorizedException("Cannot resolve userId from security context");
    }

    public static String currentRole() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) throw new UnauthorizedException("Not authenticated");
        return auth.getAuthorities().stream()
                .findFirst()
                .map(a -> a.getAuthority().replace("ROLE_", ""))
                .orElseThrow(() -> new UnauthorizedException("No role found"));
    }
}
