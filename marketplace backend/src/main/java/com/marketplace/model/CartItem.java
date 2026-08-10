package com.marketplace.model;

import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CartItem {
    private String productId;
    private String productName;
    private String vendorId;
    private String imageUrl;
    private int quantity;
    private double unitPrice;

    public double getTotalPrice() {
        return unitPrice * quantity;
    }
}
