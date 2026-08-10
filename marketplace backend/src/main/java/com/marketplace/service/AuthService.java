package com.marketplace.service;

import com.marketplace.dto.request.AuthRequest;
import com.marketplace.dto.response.AuthResponse;
import com.marketplace.enums.Role;
import com.marketplace.enums.VendorStatus;
import com.marketplace.exception.AccountNotReadyException;
import com.marketplace.exception.ResourceNotFoundException;
import com.marketplace.model.*;
import com.marketplace.repository.*;
import com.marketplace.security.JwtUtil;
import io.jsonwebtoken.Claims;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.security.authentication.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.UUID;
import org.springframework.util.StringUtils;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository   userRepository;
    private final VendorRepository vendorRepository;
    private final JwtUtil          jwtUtil;
    private final PasswordEncoder  passwordEncoder;
    private final AuthenticationManager authManager;
    private final WalletService    walletService;
    private final WalletRepository walletRepository;
    private final EmailService     emailService;
    private final RedisTemplate<String, Object> redisTemplate;

    @Value("${app.frontend-url:http://localhost:3000}")
    private String frontendUrl;

    // ── Register ──────────────────────────────────────────────────────────────

    public String register(AuthRequest.Register req) {
        if (req.getRole() == Role.ADMIN)
            throw new IllegalArgumentException("Role ADMIN is not permitted for self-registration");

        if (userRepository.existsByEmail(req.getEmail()))
            throw new IllegalStateException("Email already registered");

        /*
         * CHANGE 1 — Customer vs Vendor activation strategy at registration time.
         *
         * Previously ALL users (both CUSTOMER and VENDOR) were created with:
         *   isActive = false  →  blocked by UserDetailsServiceImpl on every login attempt
         *   emailVerified = false  →  blocked by AuthService.login() even if isActive were true
         *
         * Required business logic:
         *
         * CUSTOMER — No email verification, no admin approval needed.
         *   isActive      = true   (can log in immediately after registering)
         *   emailVerified = true   (treated as pre-verified)
         *   verificationToken = null  (no token needed, no email sent)
         *
         * VENDOR — Requires admin approval; email verification is not the gate,
         *          admin approval is.  Account stays locked until admin approves.
         *   isActive      = false  (UserDetailsServiceImpl will bypass this for
         *                           VENDOR role — see that class for details)
         *   emailVerified = false  (not used as a login gate for vendors; vendor
         *                           status is the gate — see AuthService.login())
         *   verificationToken = null  (no email-verification step for vendors)
         */
        boolean isCustomer = req.getRole() == Role.CUSTOMER;

        User user = User.builder()
                .name(req.getName())
                .email(req.getEmail())
                .password(passwordEncoder.encode(req.getPassword()))
                .role(req.getRole())
                .referralCode(UUID.randomUUID().toString()
                        .replace("-", "").substring(0, 8).toUpperCase())
                // Customers are immediately active; vendors stay inactive until approved.
                .isActive(isCustomer)
                // Customers are treated as pre-verified; vendors are gated by admin approval.
                .emailVerified(isCustomer)
                // No verification token required for either flow in the new design.
                .emailVerificationToken(null)
                .build();

        if (req.getReferralCode() != null) {
            userRepository.findByReferralCode(req.getReferralCode()).ifPresent(referrer -> {
                user.setReferredBy(referrer.getId());
                walletService.credit(referrer.getId(), 50,
                        "Referral bonus for " + req.getEmail(), null);
            });
        }

        userRepository.save(user);
        walletService.getOrCreate(user.getId());

        if (req.getRole() == Role.VENDOR) {
            if (!StringUtils.hasText(req.getStoreName()))
                throw new IllegalArgumentException(
                        "Store name is required for vendor registration");

            Vendor vendor = Vendor.builder()
                    .userId(user.getId())
                    .storeName(req.getStoreName().trim())
                    .storeDescription(req.getStoreDescription())
                    // status defaults to PENDING via @Builder.Default in Vendor.java
                    .build();

            try {
                vendorRepository.save(vendor);
            } catch (Exception e) {
                walletRepository.findByUserId(user.getId())
                        .ifPresent(walletRepository::delete);
                userRepository.delete(user);
                throw new IllegalStateException(
                        "Vendor registration failed, please try again: " + e.getMessage());
            }

            // Notify the vendor that their application was received.
            emailService.sendVendorApplicationReceived(
                    user.getEmail(), user.getName(), req.getStoreName().trim());

            /*
             * CHANGE 2 — Return a vendor-specific message that sets the correct
             * expectation: they must wait for admin approval, not click a link.
             */
            return "Vendor registration successful. Your application is under review. " +
                   "You will be notified by email once your store is approved.";
        }

        /*
         * CHANGE 3 — Customers no longer receive a verification email.
         * Previously sendVerificationEmail() was called for all roles here, which
         * sent an email even to customers who had no way to be blocked by it
         * (the verification link activated isActive, but customers already need
         * isActive=true immediately).  The call is now removed entirely for the
         * CUSTOMER path; for the VENDOR path it never reached this point anyway.
         */
        return "Registration successful. You can now log in.";
    }

    // ── Email verification ────────────────────────────────────────────────────
    // Kept intact for any users that may have been registered under the old flow
    // and still hold a pending token.  New registrations no longer generate tokens,
    // so this endpoint will be a no-op for fresh accounts but remains harmless.

    public void verifyEmail(String token) {
        User user = userRepository.findByEmailVerificationToken(token)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Invalid or expired verification token"));

        user.setActive(true);
        user.setEmailVerified(true);
        user.setEmailVerificationToken(null);
        userRepository.save(user);
    }

    // ── Login ─────────────────────────────────────────────────────────────────

    public AuthResponse.TokenPair login(AuthRequest.Login req) {
        /*
         * CHANGE 4 — authManager.authenticate() is still called first so that
         * BCrypt password verification happens regardless of role.
         *
         * For CUSTOMER / ADMIN: UserDetailsServiceImpl rejects inactive accounts
         * here, so a deactivated customer still gets "Invalid email or password"
         * (the account deactivation is not revealed to the caller, which is the
         * secure default).
         *
         * For VENDOR: UserDetailsServiceImpl deliberately lets vendors through even
         * when isActive=false so that the PENDING/REJECTED check below can return
         * a meaningful message.  See UserDetailsServiceImpl for that change.
         */
        try {
            authManager.authenticate(
                    new UsernamePasswordAuthenticationToken(req.getEmail(), req.getPassword()));
        } catch (BadCredentialsException e) {
            throw new BadCredentialsException("Invalid email or password");
        }

        User user = userRepository.findByEmail(req.getEmail())
                .orElseThrow(() -> new ResourceNotFoundException("User", req.getEmail()));

        /*
         * CHANGE 5 — Vendor status check is now performed BEFORE the emailVerified
         * check.
         *
         * Previously the order was:
         *   1. emailVerified check  ← vendors always fail here (emailVerified=false)
         *   2. vendor status check  ← never reached for vendors
         *
         * This meant a PENDING vendor received:
         *   "Please verify your email address before logging in."
         * instead of the required:
         *   "Your vendor account is awaiting admin approval."
         *
         * New order:
         *   1. Vendor role? → check vendor status → return meaningful message or token
         *   2. Non-vendor? → check emailVerified → existing behaviour preserved
         */
        if (user.getRole() == Role.VENDOR) {
            Vendor vendor = vendorRepository.findByUserId(user.getId()).orElse(null);

            if (vendor == null || vendor.getStatus() == VendorStatus.PENDING) {
                throw new AccountNotReadyException(
                        "Your vendor account is awaiting admin approval. " +
                        "You will be notified by email once your store is approved.");
            }

            if (vendor.getStatus() == VendorStatus.REJECTED) {
                throw new AccountNotReadyException(
                        "Your vendor application was rejected. " +
                        "Reason: " + (vendor.getRejectionReason() != null
                                ? vendor.getRejectionReason()
                                : "No reason provided") +
                        ". Please contact support.");
            }

            if (vendor.getStatus() == VendorStatus.BANNED) {
                throw new AccountNotReadyException(
                        "Your vendor account has been banned. Please contact support.");
            }

            // APPROVED vendor — issue the full ROLE_VENDOR token.
            return buildTokenPair(user, vendor.getId());
        }

        // Non-vendor (CUSTOMER / ADMIN): enforce email verification.
        // Customers registered under the new flow have emailVerified=true, so this
        // check passes automatically.  Any legacy unverified accounts are still
        // blocked here with a clear message.
        if (!user.isEmailVerified())
            throw new AccountNotReadyException(
                    "Please verify your email address before logging in. " +
                    "Check your inbox for the verification link.");

        return buildTokenPair(user, null);
    }

    // ── Refresh token ─────────────────────────────────────────────────────────

    public AuthResponse.TokenPair refreshToken(String refreshToken) {
        if (!jwtUtil.validateToken(refreshToken))
            throw new IllegalArgumentException("Invalid or expired refresh token");

        if (isBlacklisted(refreshToken))
            throw new IllegalArgumentException("Refresh token has been revoked");

        String userId = jwtUtil.extractSubject(refreshToken);

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId));

        String vendorId = null;
        if (user.getRole() == Role.VENDOR) {
            vendorId = vendorRepository.findByUserId(user.getId())
                    .map(Vendor::getId).orElse(null);
        }
        return buildTokenPair(user, vendorId);
    }

    // ── Logout ────────────────────────────────────────────────────────────────

    public void logout(String accessToken, String refreshToken) {
        blacklist(accessToken);
        blacklist(refreshToken);
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private boolean isBlacklisted(String token) {
        if (token == null) return false;
        try {
            return Boolean.TRUE.equals(redisTemplate.hasKey("blacklist:" + token));
        } catch (Exception e) {
            log.error("Redis unavailable during refresh blacklist check — denying token: {}",
                    e.getMessage());
            return true;
        }
    }

    private void blacklist(String token) {
        if (token == null) return;
        try {
            Claims claims = jwtUtil.extractAllClaims(token);
            long remainingMs = claims.getExpiration().getTime() - System.currentTimeMillis();
            if (remainingMs > 0)
                redisTemplate.opsForValue().set("blacklist:" + token, "1",
                        remainingMs, TimeUnit.MILLISECONDS);
        } catch (Exception e) {
            log.warn("Could not blacklist token: {}", e.getMessage());
        }
    }

    private AuthResponse.TokenPair buildTokenPair(User user, String vendorId) {
        String access  = jwtUtil.generateAccessToken(
                user.getId(), user.getEmail(), user.getRole().name(), vendorId);
        String refresh = jwtUtil.generateRefreshToken(user.getId());

        return AuthResponse.TokenPair.builder()
                .accessToken(access)
                .refreshToken(refresh)
                .tokenType("Bearer")
                .expiresIn(900)
                .user(AuthResponse.UserInfo.builder()
                        .id(user.getId())
                        .name(user.getName())
                        .email(user.getEmail())
                        .role(user.getRole().name())
                        .vendorId(vendorId)
                        .build())
                .build();
    }
}