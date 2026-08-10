package com.marketplace.controller;

import com.marketplace.dto.request.CouponRequest;
import com.marketplace.dto.response.ApiResponse;
import com.marketplace.security.SecurityUtil;
import com.marketplace.service.CouponService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Authenticated, customer-facing coupon browsing + preview.
 *
 * Distinct from PublicController's /api/public/coupons/active, which is
 * reachable without login and deliberately omits the redemption code.
 * Everything here requires ROLE_CUSTOMER (see SecurityConfig), so it's safe
 * to reveal the code — the customer still has to actually check out to
 * spend a usage slot (see OrderService.checkout -> applyCoupon, which is
 * the sole place a coupon is atomically claimed).
 */
@RestController
@RequestMapping("/api/coupons")
@RequiredArgsConstructor
@Tag(name = "Coupons")
public class CouponController {

    private final CouponService couponService;

    @GetMapping("/mine")
    public ResponseEntity<?> myCoupons() {
        return ApiResponse.ok(couponService.getMyCoupons(SecurityUtil.currentUserId()));
    }

    @PostMapping("/validate")
    public ResponseEntity<?> validate(@Valid @RequestBody CouponRequest.Validate req) {
        return ApiResponse.ok(couponService.preview(SecurityUtil.currentUserId(), req.getCode()));
    }
}
