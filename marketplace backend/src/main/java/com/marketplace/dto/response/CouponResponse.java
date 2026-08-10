package com.marketplace.dto.response;
import com.marketplace.model.Coupon;
import lombok.*;
import java.time.LocalDateTime;
import java.util.Set;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class CouponResponse {
    private String id;
    private String code;
    private String description;
    private Coupon.DiscountType discountType;
    private double discountValue;
    private double maxDiscount;
    private double minimumOrderValue;
    private LocalDateTime expiresAt;
    private boolean isActive;
    private int usageLimit;
    private int usageCount;

    // ── Targeting (admin visibility) ──
    private Set<String> applicableCategories;
    private boolean firstOrderOnly;
    private Coupon.UserSegment userSegment;
}
