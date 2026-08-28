package com.marketplace.controller;

import com.marketplace.dto.request.OrderRequest;
import com.marketplace.dto.response.ApiResponse;
import com.marketplace.security.SecurityUtil;
import com.marketplace.service.OrderService;
import com.marketplace.service.UserService;
import com.marketplace.service.VendorService;
import com.marketplace.util.PaginationUtils;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/orders")
@RequiredArgsConstructor
@Tag(name = "Orders")
public class OrderController {

    private final OrderService  orderService;
    private final VendorService vendorService;
    private final UserService   userService;

    @PostMapping("/checkout")
    public ResponseEntity<?> checkout(@Valid @RequestBody OrderRequest.Checkout req) {
        String userId = SecurityUtil.currentUserId();
        // L-8: Use lightweight name projection — avoids loading the full User
        // document (including password hash) just to obtain the display name.
        String userName = userService.getUserName(userId);
        return ApiResponse.ok("Order initiated",
                orderService.checkout(userId, userName, req));
    }

    @GetMapping("/my-orders")
    public ResponseEntity<?> myOrders(@RequestParam(defaultValue = "0") int page,
                                      @RequestParam(defaultValue = "10") int size) {
        return ApiResponse.ok(orderService.getMyOrders(SecurityUtil.currentUserId(), PaginationUtils.page(page, size)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getOrder(@PathVariable String id) {
        return ApiResponse.ok(orderService.getOrder(id, SecurityUtil.currentUserId()));
    }

    @GetMapping("/{id}/delivery-otp")
    public ResponseEntity<?> getDeliveryOtp(@PathVariable String id) {
        return ApiResponse.ok(orderService.getDeliveryOtp(id, SecurityUtil.currentUserId()));
    }

    @PutMapping("/{id}/status")
    public ResponseEntity<?> updateStatus(@PathVariable String id,
                                          @Valid @RequestBody OrderRequest.UpdateStatus req) {
        var vendor = vendorService.findByUserId(SecurityUtil.currentUserId());
        return ApiResponse.ok("Status updated", orderService.updateStatus(id, vendor.getId(), req));
    }

    @PutMapping("/{id}/tracking")
    public ResponseEntity<?> addTracking(@PathVariable String id,
                                         @Valid @RequestBody OrderRequest.AddTracking req) {
        var vendor = vendorService.findByUserId(SecurityUtil.currentUserId());
        return ApiResponse.ok("Tracking added", orderService.addTracking(id, vendor.getId(), req));
    }

    @PutMapping("/{id}/shipping-details")
    public ResponseEntity<?> updateShippingDetails(@PathVariable String id,
                                                   @Valid @RequestBody OrderRequest.UpdateShippingDetails req) {
        var vendor = vendorService.findByUserId(SecurityUtil.currentUserId());
        return ApiResponse.ok("Shipping details updated", orderService.updateShippingDetails(id, vendor.getId(), req));
    }

    @PostMapping("/{id}/generate-otp")
    public ResponseEntity<?> generateOtp(@PathVariable String id) {
        var vendor = vendorService.findByUserId(SecurityUtil.currentUserId());
        orderService.generateOtp(id, vendor.getId());
        return ApiResponse.ok("OTP generated and available in customer order details");
    }

    @PostMapping("/{id}/verify-otp")
    public ResponseEntity<?> verifyOtp(@PathVariable String id,
                                       @Valid @RequestBody OrderRequest.VerifyOtp req) {
        return ApiResponse.ok("OTP verified",
                orderService.verifyOtp(id, SecurityUtil.currentUserId(), req.getOtp(), req.getVendorId()));
    }

    @PostMapping("/{id}/cancel")
    public ResponseEntity<?> cancel(@PathVariable String id) {
        return ApiResponse.ok("Order cancelled", orderService.cancelOrder(id, SecurityUtil.currentUserId()));
    }

    @PostMapping("/verify-payment")
    public ResponseEntity<?> verify(@Valid @RequestBody OrderRequest.VerifyPayment req) {
        return ApiResponse.ok("Payment verified", orderService.verifyAndConfirm(SecurityUtil.currentUserId(), req));
    }
}
