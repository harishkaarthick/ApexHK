package com.marketplace.dto.request;

import com.marketplace.model.Coupon;
import jakarta.validation.constraints.*;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.Set;

public class CouponRequest {

    @Data
    public static class Create {
        @NotBlank  private String code;
        private    String description;
        @NotNull   private Coupon.DiscountType discountType;
        @Positive  private double discountValue;
        @PositiveOrZero private double maxDiscount;
        @PositiveOrZero private double minimumOrderValue;
        @NotNull
        @Future(message = "Expiry date must be in the future")
        private LocalDateTime expiresAt;
        @PositiveOrZero private int usageLimit;

        // ── Targeting (all optional; null/empty = no restriction) ──
        /** Empty/null = applies to every category. */
        private Set<String> applicableCategories;
        private boolean firstOrderOnly;
        /** Defaults to ALL when omitted. */
        private Coupon.UserSegment userSegment;
    }

    @Data
    public static class Validate {
        @NotBlank private String code;
    }
}
