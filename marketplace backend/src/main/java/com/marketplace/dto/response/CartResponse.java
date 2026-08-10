package com.marketplace.dto.response;

import com.marketplace.model.CartItem;
import lombok.*;

import java.util.List;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class CartResponse {
    private String id;
    private String userId;
    private List<CartItem> items;
    private double totalAmount;
    private int itemCount;
}