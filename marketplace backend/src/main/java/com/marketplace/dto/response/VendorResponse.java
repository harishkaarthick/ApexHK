package com.marketplace.dto.response;

import com.marketplace.enums.SubscriptionStatus;
import com.marketplace.enums.VendorStatus;
import lombok.*;
import java.time.LocalDateTime;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class VendorResponse {
    private String id;
    private String userId;
    private String storeName;
    private String storeDescription;
    private String storeLogo;
    private double commissionRate;
    private VendorStatus status;
    private String rejectionReason;
    private double totalEarnings;
    private double pendingPayout;
    /** Next date from which vendor is allowed to request a payout (null = no restriction). */
    private LocalDateTime nextPayoutDate;
    private LocalDateTime createdAt;

    // ── Subscription fields ──────────────────────────────────────────────────
    private String subscriptionPlan;
    private LocalDateTime subscriptionValidUntil;
    private int productLimit;
    private SubscriptionStatus subscriptionStatus;
}