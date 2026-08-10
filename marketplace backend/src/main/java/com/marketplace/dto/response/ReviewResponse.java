package com.marketplace.dto.response;

import lombok.*;
import java.time.LocalDateTime;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class ReviewResponse {
    private String id;
    private String productId;
    private String customerId;
    private String customerName;
    private String orderId;
    private int rating;
    private String title;
    private String comment;
    private boolean isApproved;
    private boolean isHidden;
    private LocalDateTime createdAt;
    private java.util.List<String> imageUrls;
}