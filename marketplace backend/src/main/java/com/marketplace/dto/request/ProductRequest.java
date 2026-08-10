package com.marketplace.dto.request;

import jakarta.validation.constraints.*;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

public class ProductRequest {

    // ── Create ────────────────────────────────────────────────────────────────
    // All required fields use primitives + constraints — correct as-is.

    @Data
    public static class Create {
        @NotBlank private String name;
        @NotBlank private String description;
        @NotBlank private String category;
        private   String  subcategory;
        private   String  brand;
        private   String  sku;
        private   List<String> tags;

        @Positive private double price;

        @PositiveOrZero private double discountedPrice;
        @PositiveOrZero private int    stock;

        private Boolean featured;
        private Map<String, String> specifications;
    }

    // ── Update ────────────────────────────────────────────────────────────────
    /*
     * FIX: All five numeric/boolean fields that can be legitimately absent from a
     * partial-update payload have been changed from primitives to their boxed
     * (nullable) equivalents:
     *
     *   double  price            → Double  price
     *   double  discountedPrice  → Double  discountedPrice
     *   int     stock            → Integer stock
     *   boolean isFeatured       → Boolean isFeatured
     *   boolean isActive         → Boolean isActive
     *
     * Why this matters:
     *   • Primitives always deserialize to their zero-value (0.0 / 0 / false) when
     *     the JSON field is absent.
     *   • @Positive on a primitive `double` rejects 0.0, so any update request
     *     that omits `price` threw a 400 validation error.
     *   • The unconditional setters in ProductService.update() used these zero-values
     *     to silently reset stock to 0, deactivate products, and remove the featured
     *     flag on every save — fixed in ProductService (next fix).
     *
     * Null now means "caller did not send this field; leave the existing value alone".
     * Bean Validation skips @Positive / @PositiveOrZero automatically when the
     * annotated value is null.
     */
    @Data
    public static class Update {
        private String name;
        private String description;
        private String category;
        private String subcategory;
        private String brand;
        private String sku;
        private List<String> tags;

        @Positive        private Double   price;            // was: double  (never nullable)
        @PositiveOrZero  private Double   discountedPrice;  // was: double
        @PositiveOrZero  private Integer  stock;            // was: int
        private          Boolean          featured;       // was: boolean
        private          Boolean          active;         // was: boolean

        private Map<String, String> specifications;
    }

    // ── Flash Sale ────────────────────────────────────────────────────────────

    @Data
    public static class FlashSaleRequest {
        @NotNull @Positive private Double      salePrice;
        @NotNull           private LocalDateTime startTime;
        @NotNull           private LocalDateTime endTime;
    }
}
