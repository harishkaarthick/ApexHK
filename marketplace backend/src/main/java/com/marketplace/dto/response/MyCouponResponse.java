package com.marketplace.dto.response;

import com.marketplace.model.Coupon;
import lombok.*;

import java.time.LocalDateTime;

/**
 * Coupon projection for an *authenticated customer* at checkout.
 *
 * Unlike PublicCouponResponse (unauthenticated, code intentionally hidden),
 * this DTO includes the code because the caller is logged in and this is
 * only reachable from /api/coupons/** which requires ROLE_CUSTOMER.
 *
 * It also carries per-user eligibility so the checkout UI can show *why*
 * a coupon can't be applied (already used / order too small) instead of
 * just hiding it or letting the customer hit a confusing 400 at payment time.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MyCouponResponse {
    private String code;
    private String description;
    private Coupon.DiscountType discountType;
    private double discountValue;
    private double maxDiscount;
    private double minimumOrderValue;
    private LocalDateTime expiresAt;

    /** true if this customer can apply the coupon to their current cart right now */
    private boolean eligible;

    /** human-readable reason when eligible == false, e.g. "Add ₹150 more to unlock" */
    private String ineligibleReason;

    /** estimated discount against the customer's current cart total (informational only —
     *  the authoritative amount is always recalculated server-side at checkout) */
    private double estimatedDiscount;
}
