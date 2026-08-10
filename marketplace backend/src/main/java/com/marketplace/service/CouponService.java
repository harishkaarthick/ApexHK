package com.marketplace.service;

import com.marketplace.dto.response.CouponPreviewResponse;
import com.marketplace.dto.response.MyCouponResponse;
import com.marketplace.exception.ResourceNotFoundException;
import com.marketplace.model.Cart;
import com.marketplace.model.CartItem;
import com.marketplace.model.Coupon;
import com.marketplace.model.Product;
import com.marketplace.repository.CartRepository;
import com.marketplace.repository.CouponRepository;
import com.marketplace.repository.OrderRepository;
import com.marketplace.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Customer-facing coupon operations: browsing coupons eligible for the
 * logged-in customer's current cart, and previewing the discount a code
 * would give *without* claiming a usage slot (that only happens atomically
 * in OrderService.checkout()).
 *
 * This is what makes coupons behave like a real storefront (Zepto/Swiggy-style):
 * the customer sees applicable offers up front, with the real discount amount,
 * before they ever hit "Pay now" — instead of typing a blind code and finding
 * out only after a payment attempt whether it worked.
 */
@Service
@RequiredArgsConstructor
public class CouponService {

    private final CouponRepository couponRepository;
    private final CartRepository   cartRepository;
    private final ProductRepository productRepository;
    private final OrderRepository   orderRepository;

    public List<MyCouponResponse> getMyCoupons(String userId) {
        Cart cart = cartRepository.findByUserId(userId).orElse(null);
        double cartTotal = cartTotal(cart);
        Set<String> cartCategories = cartCategories(cart);
        boolean hasPriorOrders = orderRepository.existsByCustomerId(userId);

        return couponRepository.findByExpiresAtAfterAndIsActiveTrue(
                        LocalDateTime.now(), org.springframework.data.domain.PageRequest.of(0, 50))
                .getContent()
                .stream()
                .map(c -> toMyCouponResponse(c, userId, cartTotal, cartCategories, hasPriorOrders))
                .toList();
    }

    /** Read-only check: does this code apply to the customer's current cart, and for how much? */
    public CouponPreviewResponse preview(String userId, String code) {
        Coupon coupon = couponRepository.findByCodeIgnoreCase(code)
                .orElseThrow(() -> new ResourceNotFoundException("Coupon", code));

        Cart cart = cartRepository.findByUserId(userId).orElse(null);
        double cartTotal = cartTotal(cart);
        Set<String> cartCategories = cartCategories(cart);
        boolean hasPriorOrders = orderRepository.existsByCustomerId(userId);

        String reason = ineligibleReason(coupon, userId, cartTotal, cartCategories, hasPriorOrders);
        if (reason != null) throw new IllegalArgumentException(reason);

        double discount = computeDiscount(coupon, cartTotal);
        return CouponPreviewResponse.builder()
                .code(coupon.getCode())
                .discount(discount)
                .totalAfterDiscount(Math.max(0, cartTotal - discount))
                .build();
    }

    // ── helpers ──────────────────────────────────────────────────────────

    private double cartTotal(Cart cart) {
        if (cart == null || cart.getItems() == null) return 0;
        return cart.getItems().stream()
                .mapToDouble(i -> i.getUnitPrice() * i.getQuantity())
                .sum();
    }

    /** Categories of the products currently in the cart, used for applicableCategories targeting. */
    private Set<String> cartCategories(Cart cart) {
        if (cart == null || cart.getItems() == null || cart.getItems().isEmpty()) return Collections.emptySet();
        List<String> productIds = cart.getItems().stream().map(CartItem::getProductId).toList();
        return productRepository.findAllById(productIds).stream()
                .map(Product::getCategory)
                .filter(cat -> cat != null && !cat.isBlank())
                .collect(Collectors.toSet());
    }

    private String ineligibleReason(Coupon c, String userId, double cartTotal, Set<String> cartCategories, boolean hasPriorOrders) {
        if (!c.isActive()) return "Coupon is inactive";
        if (c.getExpiresAt().isBefore(LocalDateTime.now())) return "Coupon has expired";
        if (c.getUsedByUserIds().contains(userId)) return "You have already used this coupon";
        if (c.getUsageLimit() > 0 && c.getUsageCount() >= c.getUsageLimit())
            return "Coupon usage limit has been reached";
        if (cartTotal < c.getMinimumOrderValue())
            return "Add \u20B9" + String.format("%.0f", c.getMinimumOrderValue() - cartTotal) + " more to unlock this coupon";
        if (c.isFirstOrderOnly() && hasPriorOrders)
            return "Valid for your first order only";
        Coupon.UserSegment segment = c.getUserSegment();
        if (segment == Coupon.UserSegment.NEW && hasPriorOrders)
            return "Valid for new customers only";
        if (segment == Coupon.UserSegment.RETURNING && !hasPriorOrders)
            return "Valid for returning customers only";
        Set<String> applicableCategories = c.getApplicableCategories();
        if (applicableCategories != null && !applicableCategories.isEmpty()
                && Collections.disjoint(applicableCategories, cartCategories))
            return "Not applicable to items in your cart";
        return null;
    }

    private double computeDiscount(Coupon c, double cartTotal) {
        double discount = c.getDiscountType() == Coupon.DiscountType.PERCENTAGE
                ? cartTotal * c.getDiscountValue() / 100
                : c.getDiscountValue();
        if (c.getMaxDiscount() > 0) discount = Math.min(discount, c.getMaxDiscount());
        return Math.min(discount, cartTotal);
    }

    private MyCouponResponse toMyCouponResponse(Coupon c, String userId, double cartTotal, Set<String> cartCategories, boolean hasPriorOrders) {
        String reason = ineligibleReason(c, userId, cartTotal, cartCategories, hasPriorOrders);
        return MyCouponResponse.builder()
                .code(c.getCode())
                .description(c.getDescription())
                .discountType(c.getDiscountType())
                .discountValue(c.getDiscountValue())
                .maxDiscount(c.getMaxDiscount())
                .minimumOrderValue(c.getMinimumOrderValue())
                .expiresAt(c.getExpiresAt())
                .eligible(reason == null)
                .ineligibleReason(reason)
                .estimatedDiscount(reason == null ? computeDiscount(c, cartTotal) : 0)
                .build();
    }
}
