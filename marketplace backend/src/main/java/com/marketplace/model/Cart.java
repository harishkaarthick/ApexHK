package com.marketplace.model;

import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "carts")
public class Cart {

    @Id
    private String id;

    @Indexed(unique = true)
    private String userId;

    @Builder.Default
    private List<CartItem> items = new ArrayList<>();

    // M-4: Use @LastModifiedDate so Spring Data Mongo manages this automatically
    // via @EnableMongoAuditing (already on MarketplaceApplication).
    // Manual cart.setUpdatedAt(LocalDateTime.now()) calls in CartService removed.
    @LastModifiedDate
    private LocalDateTime updatedAt;

    public double getTotalAmount() {
        return items.stream().mapToDouble(CartItem::getTotalPrice).sum();
    }
}
