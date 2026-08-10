package com.marketplace.controller;

import com.marketplace.dto.request.AuthRequest;
import com.marketplace.dto.response.ApiResponse;
import com.marketplace.service.AuthService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@Tag(name = "Auth")
public class AuthController {

    private final AuthService authService;

    /**
     * ISSUE-01: Role ADMIN is rejected at service level.
     * ISSUE-16: Returns a plain message; tokens are NOT issued until email is verified.
     */
    @PostMapping("/register")
    public ResponseEntity<?> register(@Valid @RequestBody AuthRequest.Register req) {
        String message = authService.register(req);
        return ApiResponse.created("Registered successfully", message);
    }

    /**
     * ISSUE-16: One-time link sent to the user's email activates their account.
     */
    @GetMapping("/verify-email")
    public ResponseEntity<?> verifyEmail(@RequestParam String token) {
        authService.verifyEmail(token);
        return ApiResponse.ok("Email verified successfully. You can now log in.");
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody AuthRequest.Login req) {
        return ApiResponse.ok("Login successful", authService.login(req));
    }

    @PostMapping("/refresh-token")
    public ResponseEntity<?> refresh(@Valid @RequestBody AuthRequest.RefreshToken req) {
        return ApiResponse.ok("Token refreshed", authService.refreshToken(req.getRefreshToken()));
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout(@Valid @RequestBody AuthRequest.Logout req,
                                    @RequestHeader("Authorization") String authHeader) {
        String accessToken = authHeader.startsWith("Bearer ") ? authHeader.substring(7) : null;
        authService.logout(accessToken, req.getRefreshToken());
        return ApiResponse.noContent("Logged out successfully");
    }
}