package com.marketplace.model;

import com.marketplace.enums.OrderStatus;
import lombok.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * A vendor's isolated portion of a multi-vendor customer {@link Order}.
 *
 * One parent Order contains exactly one VendorOrder per distinct vendor whose
 * products were purchased. All vendor-facing fulfillment state (status,
 * tracking, shipping, OTP, earnings) lives here instead of on the parent
 * Order, so that one vendor's actions never affect another vendor's view or
 * data. The parent Order keeps a flattened `items` list (all vendors) purely
 * for the customer/admin views and existing product/review lookups; vendor
 * endpoints must always go through this class instead.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VendorOrder {

    /** Stable id for this vendor-portion, independent of array position. */
    private String id;

    private String vendorId;
    private String vendorName;

    /** Reference back to the parent order, duplicated for convenience in flattened queries/DTOs. */
    private String parentOrderId;

    @Builder.Default
    private List<OrderItem> items = new ArrayList<>();

    @Builder.Default
    private OrderStatus status = OrderStatus.PENDING;

    private String cancellationReason;

    private LocalDateTime confirmedAt;

    // Shipping / tracking — vendor-specific
    private String trackingId;
    private String courierName;
    private LocalDateTime shippedDate;
    private LocalDateTime deliveredAt;

    // OTP-based delivery verification — vendor-specific
    private String deliveryOtp;
    private Boolean otpVerified;
    private LocalDateTime otpGeneratedAt;

    // Revenue — computed only from this vendor's items
    private double subtotal;
    private Double commissionAmount;
    private Double vendorEarnings;
}
