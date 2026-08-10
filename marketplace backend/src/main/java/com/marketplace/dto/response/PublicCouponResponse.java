package com.marketplace.dto.response;

import com.marketplace.model.Coupon;
import lombok.*;

import java.time.LocalDateTime;

/**
 * ISSUE-17 FIX: Safe projection for the public /api/public/coupons/active endpoint.
 *
 * The full CouponResponse exposes code, usageCount, and usageLimit to unauthenticated
 * callers, which:
 *   - Leaks the actual redemption string (code) — an attacker can harvest all valid
 *     codes without ever placing an order.
 *   - Leaks usageCount / usageLimit — reveals campaign scale and remaining budget.
 *
 * This DTO contains only the fields a shopper needs to decide whether a coupon is
 * worth using: discount terms, minimum order, and expiry.  The code itself is
 * intentionally absent; it is only returned after a customer actively applies the
 * coupon at checkout (authenticated endpoint).
 *
 * Fields deliberately omitted:
 *   - code          — redemption string; not needed for display
 *   - usageCount    — internal metric
 *   - usageLimit    — internal metric
 *   - isActive      — always true here (query already filters for active coupons)
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PublicCouponResponse {
    private String id;
    private String description;
    private Coupon.DiscountType discountType;
    private double discountValue;
    private double maxDiscount;
    private double minimumOrderValue;
    private LocalDateTime expiresAt;
}
