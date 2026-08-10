package com.marketplace.model;

import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.index.TextIndexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "products")
public class Product {

    @Id
    private String id;

    @Indexed
    private String vendorId;

    private String vendorName;

    @TextIndexed(weight = 3)
    private String name;

    @TextIndexed(weight = 2)
    private String description;

    @TextIndexed
    private String category;

    @TextIndexed
    private String subcategory;

    @TextIndexed
    private String brand;

    @TextIndexed
    private String sku;

    @TextIndexed
    @Builder.Default
    private List<String> tags = new ArrayList<>();

    @Builder.Default
    private List<String> imageUrls = new ArrayList<>();

    private double price;
    private double discountedPrice;

    @Builder.Default
    private int stock = 0;

    @Builder.Default
    private double averageRating = 0.0;

    @Builder.Default
    private int totalReviews = 0;

    @Builder.Default
    private boolean isActive = true;

    @Builder.Default
    private boolean isFeatured = false;

    private FlashSale flashSale;

    @Builder.Default
    private Map<String, String> specifications = new HashMap<>();

    @CreatedDate
    private LocalDateTime createdAt;

    @LastModifiedDate
    private LocalDateTime updatedAt;

    public double getEffectivePrice() {
        if (flashSale != null && flashSale.isActive())
            return flashSale.getSalePrice();
        if (discountedPrice > 0 && discountedPrice < price)
            return discountedPrice;
        return price;
    }
}
