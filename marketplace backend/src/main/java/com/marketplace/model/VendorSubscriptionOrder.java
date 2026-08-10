package com.marketplace.model;

import com.marketplace.enums.SubscriptionStatus;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

/**
 * One document per subscription purchase/renewal attempt.
 *
 * This is the audit trail that the bare Vendor.subscriptionPlan/validUntil
 * fields cannot provide, and the source of truth that /verify must check
 * against instead of trusting client-supplied plan/amount.
 *
 * Mirrors WalletTopupOrder — the existing, correct reference implementation
 * of this pattern in this codebase.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "vendor_subscription_orders")
public class VendorSubscriptionOrder {

    @Id
    private String id;

    @Indexed
    private String vendorId;

    @Indexed
    private String userId;

    /** Plan locked in at initiate time — /verify activates THIS plan, never the request body. */
    private String plan;

    /** Amount in INR paise, locked in at initiate time. */
    private long amount;

    @Indexed(unique = true, sparse = true)
    private String razorpayOrderId;

    private String paymentId;

    @Builder.Default
    private SubscriptionStatus status = SubscriptionStatus.PENDING;

    /** Validity days from PlanConfig, captured at initiate time. */
    private int validityDays;

    @CreatedDate
    private LocalDateTime createdAt;

    private LocalDateTime completedAt;
}
