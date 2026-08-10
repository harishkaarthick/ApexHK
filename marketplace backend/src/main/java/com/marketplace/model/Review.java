package com.marketplace.model;

import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "reviews")
@CompoundIndexes({
    @CompoundIndex(name = "one_review_per_product",
                   def = "{'customerId': 1, 'productId': 1}", unique = true)
})
public class Review {

    @Id
    private String id;

    private String productId;
    private String customerId;
    private String customerName;
    private String orderId;
    private int rating;
    private String title;
    private String comment;

    @Builder.Default
    private java.util.List<String> imageUrls = new java.util.ArrayList<>();


    @Builder.Default
    private boolean isApproved = true;

    @Builder.Default
    private boolean isHidden = false;

    @CreatedDate
    private LocalDateTime createdAt;
}
