package com.marketplace.dto.response;

import com.marketplace.enums.OrderStatus;
import com.marketplace.model.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.List;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class OrderResponse {
    private String id;
    private String customerId;
    private String customerName;
    private List<OrderItem> items;

    /**
     * For customer/admin views: every vendor's portion of the order (full detail).
     * For vendor views (GET /api/vendor/orders, GET /api/orders/{id} as a vendor):
     * this list contains EXACTLY ONE entry — the authenticated vendor's own portion.
     * Vendor A will never find Vendor B's entry here.
     */
    private List<VendorOrder> vendorOrders;

    private Address shippingAddress;
    private double totalAmount;
    private double discountAmount;
    private double walletAmountUsed;
    private double razorpayAmount;
    private String couponCode;
    private String razorpayOrderId;
    private String paymentId;
    private OrderStatus status;
    private String trackingId;
    private LocalDateTime placedAt;
    private LocalDateTime deliveredAt;

    // OTP-Based Delivery Verification
    private Boolean deliveryOtpGenerated;
    private Boolean otpVerified;
    private LocalDateTime otpGeneratedAt;

    // Shipping Information
    private String courierName;
    private LocalDateTime shippedDate;

    // Revenue and Commission Tracking
    private Double commissionAmount;
    private Double vendorEarnings;

    private String key;
    private long amount;
    private String currency;
}
