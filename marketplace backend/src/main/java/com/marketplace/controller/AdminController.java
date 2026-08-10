package com.marketplace.controller;

import com.marketplace.dto.request.*;
import com.marketplace.dto.response.ApiResponse;
import com.marketplace.enums.OrderStatus;
import com.marketplace.enums.ReturnStatus;
import com.marketplace.enums.VendorStatus;
import com.marketplace.security.SecurityUtil;
import com.marketplace.service.AdminService;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.*;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;

@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
@Tag(name = "Admin")
public class AdminController {

    private final AdminService adminService;

    @GetMapping("/users")
    public ResponseEntity<?> users(@RequestParam(defaultValue = "0") int page,
                                   @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.ok(adminService.getAllUsers(PageRequest.of(page, size)));
    }

    @PutMapping("/users/{id}/toggle")
    public ResponseEntity<?> toggleUser(@PathVariable String id) {
        adminService.toggleUser(id, SecurityUtil.currentUserId());
        return ApiResponse.noContent("User status toggled");
    }

    @GetMapping("/orders")
    public ResponseEntity<?> orders(@RequestParam(defaultValue = "0") int page,
                                    @RequestParam(defaultValue = "20") int size,
                                    @RequestParam(required = false) OrderStatus status,
                                    @RequestParam(required = false)
                                    @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,
                                    @RequestParam(required = false)
                                    @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to,
                                    @RequestParam(required = false) String customerId) {
        return ApiResponse.ok(adminService.getAllOrders(
                PageRequest.of(page, size, Sort.by("placedAt").descending()),
                status, from, to, customerId));
    }

    @GetMapping("/vendors/pending")
    public ResponseEntity<?> pendingVendors(@RequestParam(defaultValue = "0") int page,
                                            @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.ok(adminService.getPendingVendors(PageRequest.of(page, size)));
    }

    @GetMapping("/vendors")
    public ResponseEntity<?> allVendors(@RequestParam(defaultValue = "0") int page,
                                        @RequestParam(defaultValue = "20") int size,
                                        @RequestParam(required = false) VendorStatus status) {
        return ApiResponse.ok(adminService.getAllVendors(PageRequest.of(page, size), status));
    }

    @PutMapping("/vendors/{id}/approve")
    public ResponseEntity<?> approveVendor(@PathVariable String id) {
        return ApiResponse.ok("Vendor approved", adminService.approveVendor(id));
    }

    @PutMapping("/vendors/{id}/reject")
    public ResponseEntity<?> rejectVendor(@PathVariable String id,
                                          @Valid @RequestBody VendorRequest.Reject req) {
        return ApiResponse.ok("Vendor rejected", adminService.rejectVendor(id, req));
    }

    // L-4: The UpdateCommission DTO was defined but no endpoint used it.
    // Admins can now adjust a vendor's commission rate after registration.
    @PutMapping("/vendors/{id}/commission")
    public ResponseEntity<?> updateCommission(@PathVariable String id,
                                              @Valid @RequestBody VendorRequest.UpdateCommission req) {
        return ApiResponse.ok("Commission updated", adminService.updateVendorCommission(id, req));
    }

    @GetMapping("/payouts")
    public ResponseEntity<?> payouts(@RequestParam(defaultValue = "0") int page,
                                     @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.ok(adminService.getAllPayouts(
                PageRequest.of(page, size, Sort.by("requestedAt").descending())));
    }

    @GetMapping("/payouts/pending")
    public ResponseEntity<?> pendingPayouts(@RequestParam(defaultValue = "0") int page,
                                            @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.ok(adminService.getPendingPayouts(
                PageRequest.of(page, size, Sort.by("requestedAt").descending())));
    }

    @PostMapping("/payouts/{id}/approve")
    public ResponseEntity<?> approvePayout(@PathVariable String id) {
        return ApiResponse.ok("Payout approved", adminService.approvePayout(id, SecurityUtil.currentUserId()));
    }

    @PostMapping("/payouts/{id}/reject")
    public ResponseEntity<?> rejectPayout(@PathVariable String id,
                                          @Valid @RequestBody VendorRequest.Reject req) {
        return ApiResponse.ok("Payout rejected", adminService.rejectPayout(id, req, SecurityUtil.currentUserId()));
    }

    @PostMapping("/coupons")
    public ResponseEntity<?> createCoupon(@Valid @RequestBody CouponRequest.Create req) {
        return ApiResponse.created("Coupon created", adminService.createCoupon(req));
    }

    @GetMapping("/coupons")
    public ResponseEntity<?> coupons(@RequestParam(defaultValue = "0") int page,
                                     @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.ok(adminService.getCoupons(PageRequest.of(page, size)));
    }

    @PutMapping("/coupons/{id}/toggle")
    public ResponseEntity<?> toggleCoupon(@PathVariable String id) {
        adminService.toggleCoupon(id);
        return ApiResponse.noContent("Coupon toggled");
    }

    @DeleteMapping("/coupons/{id}")
    public ResponseEntity<?> deleteCoupon(@PathVariable String id) {
        adminService.deleteCoupon(id);
        return ApiResponse.noContent("Coupon deleted");
    }

    @PostMapping(value = "/banners", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?>  createBanner(@Valid @RequestPart("data") BannerRequest.Create req,
                                          @RequestPart("image") MultipartFile image) {
        return ApiResponse.created("Banner created", adminService.createBanner(req, image));
    }

    @GetMapping("/banners")
    public ResponseEntity<?> banners(@RequestParam(defaultValue = "0") int page,
                                     @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.ok(adminService.getBanners(PageRequest.of(page, size)));
    }

    @PutMapping("/banners/{id}/toggle")
    public ResponseEntity<?> toggleBanner(@PathVariable String id) {
        adminService.toggleBanner(id);
        return ApiResponse.noContent("Banner toggled");
    }

    @DeleteMapping("/banners/{id}")
    public ResponseEntity<?> deleteBanner(@PathVariable String id) {
        adminService.deleteBanner(id);
        return ApiResponse.noContent("Banner deleted");
    }

@GetMapping("/returns")
    public ResponseEntity<?> returns(@RequestParam(defaultValue = "0") int page,
                                      @RequestParam(defaultValue = "20") int size,
                                      @RequestParam(required = false) ReturnStatus status) {
        return ApiResponse.ok(adminService.getAllReturns(PageRequest.of(page, size), status));
    }

    @GetMapping("/returns/analytics")
    public ResponseEntity<?> returnsAnalytics() {
        return ApiResponse.ok(adminService.getReturnsAnalytics());
    }

    @PutMapping("/returns/{id}/resolve")
    public ResponseEntity<?> resolveReturn(@PathVariable String id,
                                          @Valid @RequestBody ReturnRequestDto.UpdateStatus req) {
        return ApiResponse.ok("Return resolved", adminService.resolveReturn(id, req));
    }

    @PutMapping("/returns/{id}/appeal/resolve")
    public ResponseEntity<?> resolveAppeal(@PathVariable String id,
                                          @Valid @RequestBody ReturnRequestDto.UpdateStatus req,
                                          @RequestParam String resolutionReason) {
        return ApiResponse.ok("Appeal resolved", adminService.resolveAppeal(id, req, resolutionReason));
    }

    @GetMapping("/products")
    public ResponseEntity<?> products(@RequestParam(defaultValue = "0") int page,
                                      @RequestParam(defaultValue = "20") int size,
                                      @RequestParam(required = false) String vendorId) {
        return ApiResponse.ok(adminService.getAllProducts(PageRequest.of(page, size), vendorId));
    }

    @DeleteMapping("/products/{id}")
    public ResponseEntity<?> removeProduct(@PathVariable String id) {
        adminService.removeProduct(id);
        return ApiResponse.noContent("Product removed by admin");
    }

    @GetMapping({"/stats", "/dashboard"})
    public ResponseEntity<?> dashboard() {
        return ApiResponse.ok(adminService.getDashboardStats());
    }

    // ── Subscription management ───────────────────────────────────────────────

    /**
     * GET /api/admin/subscriptions?plan=PREMIUM&page=0&size=20
     * Lists all subscription purchase orders across all vendors.
     * Optionally filter by plan name.
     */
    @GetMapping("/subscriptions")
    public ResponseEntity<?> allSubscriptions(
            @RequestParam(defaultValue = "0")  int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false)    String plan) {
        return ApiResponse.ok(adminService.getAllSubscriptions(plan, PageRequest.of(page, size)));
    }

    /**
     * POST /api/admin/subscriptions/{vendorId}/cancel
     * Immediately cancels a vendor's active paid subscription and downgrades to FREE.
     */
    @PostMapping("/subscriptions/{vendorId}/cancel")
    public ResponseEntity<?> cancelSubscription(@PathVariable String vendorId) {
        return ApiResponse.ok("Subscription cancelled", adminService.cancelVendorSubscription(vendorId));
    }

    // Add this inside AdminController class
@PutMapping("/products/{id}/toggle-visibility")
public ResponseEntity<?> toggleProductVisibility(@PathVariable String id) {
    adminService.toggleProductVisibility(id);
    return ApiResponse.noContent("Product visibility toggled");
}
}
