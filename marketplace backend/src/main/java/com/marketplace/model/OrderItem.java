package com.marketplace.model;

import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrderItem {
    private String id;
    private String productId;
    private String productName;
    private String vendorId;
    private String vendorName;
    private String imageUrl;
    private int quantity;
    private double unitPrice;
    private double totalPrice;
    private boolean returnRequest;
}
