package com.marketplace.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.marketplace.enums.OrderStatus;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "orders")
public class Order {

    @Id
    private String id;

    @Indexed
    private String customerId;

    private String customerName;

    /**
     * Flattened list of ALL items across ALL vendors in this order. Kept for
     * backward compatibility and for customer/admin views that need the full
     * picture. Vendor-facing code must NEVER read/write directly from this
     * list — use {@link #vendorOrders} instead, which is scoped per vendor.
     */
    @Builder.Default
    private List<OrderItem> items = new ArrayList<>();

    /**
     * One entry per distinct vendor represented in {@link #items}. This is the
     * source of truth for all vendor-specific fulfillment state (status,
     * tracking, OTP, earnings). Vendor A's entry is never visible to, or
     * mutable by, Vendor B.
     */
    @Builder.Default
    private List<VendorOrder> vendorOrders = new ArrayList<>();

    private Address shippingAddress;

    private double totalAmount;
    private double discountAmount;
    private double walletAmountUsed;
    private double razorpayAmount;

    private String couponCode;

    @Indexed(sparse = true)
    private String razorpayOrderId;

    private String paymentId;

    /**
     * Aggregate, customer/admin-facing status derived from every entry in
     * {@link #vendorOrders} (see OrderService#computeParentStatus). Never set
     * this directly from a vendor action — always recompute it after mutating
     * a VendorOrder.
     */
    @Builder.Default
    private OrderStatus status = OrderStatus.PENDING;

    /** @deprecated legacy single-shipment field, retained only for pre-migration orders. */
    @Deprecated
    private String trackingId;
    private String cancellationReason;

    @CreatedDate
    private LocalDateTime placedAt;

    // FIX H-3: Recorded when an order transitions to CONFIRMED so that
    // cancelOrder() can enforce a time-limited cancellation window.
    // Null for orders that were never confirmed (PENDING → CANCELLED).
    private LocalDateTime confirmedAt;

    private LocalDateTime deliveredAt;

    // OTP-Based Delivery Verification
    @JsonIgnore
    private String deliveryOtp;
    private Boolean otpVerified;
    private LocalDateTime otpGeneratedAt;

    // Shipping Information
    private String courierName;
    private LocalDateTime shippedDate;

    // Revenue and Commission Tracking
    private Double commissionAmount;
    private Double vendorEarnings;
}
