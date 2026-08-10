package com.marketplace.model;

import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "coupons")
public class Coupon {

    @Id
    private String id;

    @Indexed(unique = true)
    private String code;

    private String description;

    public enum DiscountType { PERCENTAGE, FLAT }

    private DiscountType discountType;
    private double discountValue;
    private double maxDiscount;
    private double minimumOrderValue;
    private LocalDateTime expiresAt;

    @Builder.Default
    private boolean isActive = true;

    @Builder.Default
    private int usageLimit = 0;

    @Builder.Default
    private int usageCount = 0;

    @Builder.Default
    private Set<String> usedByUserIds = new HashSet<>();

    // ── Targeting (visibility/eligibility only — does NOT affect discount math) ──

    public enum UserSegment { ALL, NEW, RETURNING }

    /** Product categories this coupon applies to. Empty/null = applies to all categories. */
    @Builder.Default
    private Set<String> applicableCategories = new HashSet<>();

    /** If true, only customers with zero prior orders may use this coupon. */
    @Builder.Default
    private boolean firstOrderOnly = false;

    /** ALL (default) / NEW (no prior orders) / RETURNING (has prior orders). */
    @Builder.Default
    private UserSegment userSegment = UserSegment.ALL;
}
