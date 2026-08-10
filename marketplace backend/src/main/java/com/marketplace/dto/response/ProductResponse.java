package com.marketplace.dto.response;

import com.marketplace.model.FlashSale;
import lombok.*;

import java.time.LocalDateTime;
import java.util.*;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class ProductResponse {
    private String id;
    private String vendorId;
    private String vendorName;
    private String name;
    private String description;
    private String category;
    private String subcategory;
    private String brand;
    private String sku;
    private List<String> tags;
    private List<String> imageUrls;
    private double price;
    private double discountedPrice;
    private double effectivePrice;
    private int stock;
    private double averageRating;
    private int totalReviews;
    private boolean isActive;
    private boolean isFeatured;
    private FlashSale flashSale;
    private Map<String, String> specifications;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
