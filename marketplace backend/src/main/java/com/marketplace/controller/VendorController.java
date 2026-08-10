package com.marketplace.controller;

import com.marketplace.dto.request.*;
import com.marketplace.dto.response.ApiResponse;
import com.marketplace.security.SecurityUtil;
import com.marketplace.service.*;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/vendor")
@RequiredArgsConstructor
@Tag(name = "Vendor")
public class VendorController {

    private final VendorService  vendorService;
    private final OrderService   orderService;
    private final ProductService productService;
    private final ReturnService  returnService;

    // ── Store ─────────────────────────────────────────────────────────────────

    @GetMapping("/store")
    public ResponseEntity<?> myStore() {
        return ApiResponse.ok(vendorService.getMyStore(SecurityUtil.currentUserId()));
    }

    @PutMapping(value = "/store", consumes = "multipart/form-data")
    public ResponseEntity<?> updateStore(@RequestPart("data") VendorRequest.UpdateStore req,
                                         @RequestPart(value = "logo", required = false) MultipartFile logo) {
        return ApiResponse.ok("Store updated", vendorService.updateStore(SecurityUtil.currentUserId(), req, logo));
    }

    // ── Subscription ──────────────────────────────────────────────────────────

    /**
     * GET /api/vendor/subscription/plans
     * FIX §5.2: Serves plan metadata from the backend — single source of truth.
     * Frontend should fetch from here instead of hard-coding the PLANS array.
     */
    @GetMapping("/subscription/plans")
    public ResponseEntity<?> subscriptionPlans() {
        return ApiResponse.ok(vendorService.getPlans());
    }

    /**
     * GET /api/vendor/subscription/current
     * Dedicated endpoint for the current vendor's subscription status.
     */
    @GetMapping("/subscription/current")
    public ResponseEntity<?> currentSubscription() {
        return ApiResponse.ok(vendorService.getCurrentSubscription(SecurityUtil.currentUserId()));
    }

    /**
     * GET /api/vendor/subscription/history
     * FIX §5.4: Returns paginated subscription purchase history.
     */
    @GetMapping("/subscription/history")
    public ResponseEntity<?> subscriptionHistory(
            @RequestParam(defaultValue = "0")  int page,
            @RequestParam(defaultValue = "10") int size) {
        return ApiResponse.ok(vendorService.getSubscriptionHistory(
                SecurityUtil.currentUserId(), PageRequest.of(page, size)));
    }

    /**
     * POST /api/vendor/subscription/initiate
     * Body: { "plan": "BASIC" }
     *
     * FIX §1.1 / §1.4: Now persists a PENDING VendorSubscriptionOrder before
     * returning the Razorpay order, closing the plan-tampering and replay holes.
     */
    @PostMapping("/subscription/initiate")
    public ResponseEntity<?> initiateSubscription(
            @Valid @RequestBody VendorRequest.SubscribePlan req) {
        return ApiResponse.ok(
                vendorService.initiateSubscriptionPayment(
                        SecurityUtil.currentUserId(), req.getPlan()));
    }

    /**
     * POST /api/vendor/subscription/verify
     * Body: { plan, razorpayOrderId?, razorpayPaymentId?, razorpaySignature? }
     *
     * FIX §1.1: plan is looked up from the persisted order, not the request body.
     * FIX §1.2: atomic PENDING→ACTIVE transition prevents replay attacks.
     */
    @PostMapping("/subscription/verify")
    public ResponseEntity<?> verifySubscription(
            @Valid @RequestBody VendorRequest.VerifySubscription req) {
        return ApiResponse.ok(
                "Plan activated",
                vendorService.activateSubscription(
                        SecurityUtil.currentUserId(),
                        req.getPlan(),
                        req.getRazorpayOrderId(),
                        req.getRazorpayPaymentId(),
                        req.getRazorpaySignature()));
    }

    // ── Orders ────────────────────────────────────────────────────────────────

    @GetMapping("/orders")
    public ResponseEntity<?> orders(
            @RequestParam(defaultValue = "0")  int    page,
            @RequestParam(defaultValue = "10") int    size,
            @RequestParam(required = false)    String searchOrderId,
            @RequestParam(required = false)    String searchCustomerName,
            @RequestParam(required = false)    String searchProductName,
            @RequestParam(required = false)    String status,
            @RequestParam(required = false)    String startDate,
            @RequestParam(required = false)    String endDate) {
        var vendor = vendorService.findByUserId(SecurityUtil.currentUserId());
        return ApiResponse.ok(orderService.getVendorOrders(
                vendor.getId(), PageRequest.of(page, size),
                searchOrderId, searchCustomerName, searchProductName,
                status, startDate, endDate));
    }

    @GetMapping("/orders/stats")
    public ResponseEntity<?> orderStats() {
        var vendor = vendorService.findByUserId(SecurityUtil.currentUserId());
        return ApiResponse.ok(orderService.getVendorOrderStats(vendor.getId()));
    }

    // ── Products ──────────────────────────────────────────────────────────────

    @GetMapping("/products")
    public ResponseEntity<?> products(@RequestParam(defaultValue = "0") int page,
                                      @RequestParam(defaultValue = "20") int size) {
        var vendor = vendorService.findByUserId(SecurityUtil.currentUserId());
        return ApiResponse.ok(productService.getVendorProducts(vendor.getId(), PageRequest.of(page, size)));
    }

    // ── Returns ───────────────────────────────────────────────────────────────

    @GetMapping("/returns")
    public ResponseEntity<?> returns(@RequestParam(defaultValue = "0") int page,
                                     @RequestParam(defaultValue = "10") int size) {
        var vendor = vendorService.findByUserId(SecurityUtil.currentUserId());
        return ApiResponse.ok(returnService.getVendorReturns(vendor.getId(), PageRequest.of(page, size)));
    }

    @GetMapping("/returns/{id}")
    public ResponseEntity<?> returnDetail(@PathVariable String id) {
        var vendor = vendorService.findByUserId(SecurityUtil.currentUserId());
        return ApiResponse.ok(returnService.getVendorReturnById(id, vendor.getId()));
    }

    @GetMapping("/returns/pending")
    public ResponseEntity<?> pendingReturns(@RequestParam(defaultValue = "0") int page,
                                            @RequestParam(defaultValue = "10") int size) {
        var vendor = vendorService.findByUserId(SecurityUtil.currentUserId());
        return ApiResponse.ok(returnService.getVendorPendingReturns(vendor.getId(), PageRequest.of(page, size)));
    }

    @PutMapping("/returns/{id}/review")
    public ResponseEntity<?> reviewReturn(@PathVariable String id,
                                          @Valid @RequestBody ReturnRequestDto.UpdateStatus req) {
        var vendor = vendorService.findByUserId(SecurityUtil.currentUserId());
        return ApiResponse.ok("Return reviewed", returnService.vendorReview(id, vendor.getId(), req));
    }

    @PostMapping("/returns/{id}/approve")
    public ResponseEntity<?> approveReturn(@PathVariable String id) {
        var vendor = vendorService.findByUserId(SecurityUtil.currentUserId());
        return ApiResponse.ok("Return approved", returnService.vendorApprove(id, vendor.getId()));
    }

    @PostMapping("/returns/{id}/reject")
    public ResponseEntity<?> rejectReturn(@PathVariable String id,
                                          @RequestBody @Valid ReturnRequestDto.Reject req) {
        var vendor = vendorService.findByUserId(SecurityUtil.currentUserId());
        return ApiResponse.ok("Return rejected", returnService.vendorReject(id, vendor.getId(), req));
    }

    @PutMapping("/returns/{id}/pickup")
    public ResponseEntity<?> schedulePickup(@PathVariable String id,
                                            @Valid @RequestBody ReturnRequestDto.PickupSchedule req) {
        var vendor = vendorService.findByUserId(SecurityUtil.currentUserId());
        return ApiResponse.ok("Pickup scheduled", returnService.vendorSchedulePickup(id, vendor.getId(), req));
    }

    @PutMapping("/returns/{id}/pickup/mark")
    public ResponseEntity<?> markPickedUp(@PathVariable String id) {
        var vendor = vendorService.findByUserId(SecurityUtil.currentUserId());
        return ApiResponse.ok("Marked as picked up", returnService.vendorMarkPickedUp(id, vendor.getId()));
    }

    @PutMapping("/returns/{id}/warehouse/receive")
    public ResponseEntity<?> markReceived(@PathVariable String id) {
        var vendor = vendorService.findByUserId(SecurityUtil.currentUserId());
        return ApiResponse.ok("Marked as received", returnService.vendorMarkReceived(id, vendor.getId()));
    }

    @PutMapping("/returns/{id}/quality/check")
    public ResponseEntity<?> qualityCheck(@PathVariable String id,
                                          @Valid @RequestBody ReturnRequestDto.QualityCheck req) {
        var vendor = vendorService.findByUserId(SecurityUtil.currentUserId());
        return ApiResponse.ok("Quality check completed", returnService.vendorQualityCheck(id, vendor.getId(), req));
    }

    @PutMapping("/returns/{id}/refund/initiate")
    public ResponseEntity<?> initiateRefund(@PathVariable String id,
                                            @Valid @RequestBody ReturnRequestDto.Refund req) {
        var vendor = vendorService.findByUserId(SecurityUtil.currentUserId());
        return ApiResponse.ok("Refund initiated", returnService.initiateRefund(id, vendor.getId(), req));
    }

    @PutMapping("/returns/{id}/refund/complete")
    public ResponseEntity<?> completeRefund(@PathVariable String id) {
        var vendor = vendorService.findByUserId(SecurityUtil.currentUserId());
        return ApiResponse.ok("Refund completed", returnService.completeRefund(id, vendor.getId()));
    }

    // ── Payout ───────────────────────────────────────────────────────────────

    @PostMapping("/payout/request")
    public ResponseEntity<?> requestPayout() {
        var vendor = vendorService.findByUserId(SecurityUtil.currentUserId());
        return ApiResponse.ok("Payout request submitted", vendorService.requestPayout(vendor));
    }

    @GetMapping("/payout/history")
    public ResponseEntity<?> payoutHistory(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        var vendor = vendorService.findByUserId(SecurityUtil.currentUserId());
        return ApiResponse.ok(vendorService.getMyPayoutHistory(vendor.getId(), PageRequest.of(page, size)));
    }
}