package com.marketplace.service;

import com.marketplace.dto.response.BannerResponse;
import com.marketplace.dto.response.PagedResponse;
import com.marketplace.dto.response.PublicCouponResponse;
import com.marketplace.enums.BannerPlacement;
import com.marketplace.model.Banner;
import com.marketplace.model.Coupon;
import com.marketplace.repository.BannerRepository;
import com.marketplace.repository.CouponRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class PublicService {

    private final BannerRepository bannerRepository;
    private final CouponRepository couponRepository;

    /**
     * FIX 3e: Previously called findByIsActiveTrueOrderByDisplayOrderAsc(), which
     * returned every active banner regardless of expiresAt — expired banners stayed
     * publicly visible indefinitely.
     *
     * Now delegates to findActiveNonExpired(now), which the @Query in BannerRepository
     * restricts to banners where expiresAt is null (permanent) or in the future.
     *
     * Cache note: the "banners" cache has a 10-minute TTL (spring.cache.redis.time-to-live).
     * A banner that expires mid-window may still be served for up to 10 minutes.
     * That is the accepted trade-off for this TTL; reduce it or evict the cache
     * on banner mutation if stricter freshness is required.
     */
    @Cacheable("banners")
    public List<BannerResponse> getActiveBanners() {
        return bannerRepository.findActiveNonExpired(LocalDateTime.now())
                .stream().map(this::toBannerResponse).toList();
    }

    /**
     * Same as getActiveBanners() but scoped to a single placement (HOME hero
     * carousel vs CATEGORY section banner), so the storefront can render each
     * slot independently. Cached per-placement so the "banners" cache key
     * doesn't collide with getActiveBanners().
     */
    @Cacheable(value = "banners", key = "#placement")
    public List<BannerResponse> getActiveBanners(BannerPlacement placement) {
        return bannerRepository.findActiveNonExpiredByPlacement(LocalDateTime.now(), placement)
                .stream().map(this::toBannerResponse).toList();
    }

    // ISSUE-17 FIX: returns PublicCouponResponse (safe projection) instead of the
    // full CouponResponse, so code/usageCount/usageLimit are never sent to
    // unauthenticated callers.
    public PagedResponse<PublicCouponResponse> getActiveCoupons(Pageable pageable) {
        return PagedResponse.of(
                couponRepository.findByExpiresAtAfterAndIsActiveTrue(LocalDateTime.now(), pageable)
                        .map(this::toPublicCouponResponse));
    }

    // ── mappers ───────────────────────────────────────────────────────────────

    private BannerResponse toBannerResponse(Banner b) {
        return BannerResponse.builder()
                .id(b.getId())
                .title(b.getTitle())
                .imageUrl(b.getImageUrl())
                .linkUrl(b.getLinkUrl())
                .description(b.getDescription())
                .isActive(b.isActive())
                .displayOrder(b.getDisplayOrder())
                .createdAt(b.getCreatedAt())
                .expiresAt(b.getExpiresAt())
                .placement(b.getPlacement())
                .build();
    }

    // ISSUE-17 FIX: maps to PublicCouponResponse — code, usageCount, usageLimit
    // are intentionally excluded from this public-facing projection.
    private PublicCouponResponse toPublicCouponResponse(Coupon c) {
        return PublicCouponResponse.builder()
                .id(c.getId())
                .description(c.getDescription())
                .discountType(c.getDiscountType())
                .discountValue(c.getDiscountValue())
                .maxDiscount(c.getMaxDiscount())
                .minimumOrderValue(c.getMinimumOrderValue())
                .expiresAt(c.getExpiresAt())
                .build();
    }
}