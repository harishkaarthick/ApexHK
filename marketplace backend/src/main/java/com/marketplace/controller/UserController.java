package com.marketplace.controller;

import com.marketplace.dto.request.UserRequest;
import com.marketplace.dto.response.ApiResponse;
import com.marketplace.security.SecurityUtil;
import com.marketplace.service.UserService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
@Tag(name = "Users")
public class UserController {

    private final UserService userService;

    // ISSUE-02 FIX: All endpoints now return UserResponse (safe projection) instead of
    // the raw User entity, which exposed the BCrypt password hash to every caller.
    @GetMapping("/me")
    public ResponseEntity<?> me() {
        return ApiResponse.ok(userService.getMeResponse(SecurityUtil.currentUserId()));
    }

    @PutMapping("/me")
    public ResponseEntity<?> update(@RequestBody UserRequest.UpdateProfile req) {
        return ApiResponse.ok("Profile updated", userService.updateProfileResponse(SecurityUtil.currentUserId(), req));
    }

    @PutMapping("/me/password")
    public ResponseEntity<?> changePassword(@Valid @RequestBody UserRequest.ChangePassword req) {
        userService.changePassword(SecurityUtil.currentUserId(), req);
        return ApiResponse.noContent("Password changed");
    }

    @PostMapping("/me/addresses")
    public ResponseEntity<?> addAddress(@Valid @RequestBody UserRequest.AddAddress req) {
        return ApiResponse.created("Address added", userService.addAddressResponse(SecurityUtil.currentUserId(), req));
    }

    @DeleteMapping("/me/addresses/{addressId}")
    public ResponseEntity<?> removeAddress(@PathVariable String addressId) {
        return ApiResponse.ok("Address removed", userService.removeAddressResponse(SecurityUtil.currentUserId(), addressId));
    }

    @PutMapping("/me/addresses/{addressId}/default")
    public ResponseEntity<?> setDefault(@PathVariable String addressId) {
        return ApiResponse.ok("Default address set", userService.setDefaultAddressResponse(SecurityUtil.currentUserId(), addressId));
    }
}