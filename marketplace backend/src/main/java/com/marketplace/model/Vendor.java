package com.marketplace.model;

import com.marketplace.enums.SubscriptionStatus;
import com.marketplace.enums.VendorStatus;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "vendors")
public class Vendor {

    @Id
    private String id;

    @Indexed(unique = true)
    private String userId;

    private String storeName;
    private String storeDescription;
    private String storeLogo;

    @Builder.Default
    private double commissionRate = 10.0;

    @Builder.Default
    private VendorStatus status = VendorStatus.PENDING;

    private String rejectionReason;

    @Builder.Default
    private double totalEarnings = 0.0;

    @Builder.Default
    private double pendingPayout = 0.0;

    // ── Subscription fields ──────────────────────────────────────────────────
    @Builder.Default
    private String subscriptionPlan = "FREE";          // FREE | BASIC | PREMIUM | ENTERPRISE

    private LocalDateTime subscriptionValidUntil;

    @Builder.Default
    private int productLimit = 10;                      // 10 / 100 / -1 (unlimited)

    /** Tracks subscription lifecycle; FREE is always ACTIVE. */
    @Builder.Default
    private SubscriptionStatus subscriptionStatus = SubscriptionStatus.ACTIVE;

    /**
     * FIX §3.3: Atomic product counter used by ProductService to enforce product
     * limits without a TOCTOU race. Incremented atomically on create, decremented
     * on soft-delete. Value of -1 (unlimited) is never set here — unlimited is
     * expressed as productLimit == -1 and this counter is simply not checked.
     */
    @Builder.Default
    private int activeProductCount = 0;

    /**
     * Set to now()+7 days when a payout is approved/paid.
     * Vendor cannot submit a new payout request before this date.
     */
    private LocalDateTime nextPayoutDate;

    @CreatedDate
    private LocalDateTime createdAt;

    @LastModifiedDate
    private LocalDateTime updatedAt;
}