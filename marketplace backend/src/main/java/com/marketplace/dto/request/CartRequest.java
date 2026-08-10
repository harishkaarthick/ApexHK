package com.marketplace.dto.request;

import jakarta.validation.constraints.*;
import lombok.Data;

public class CartRequest {

    @Data
    public static class AddItem {
        @NotBlank private String productId;
        @Min(1) private int quantity;
    }

    @Data
    public static class UpdateItem {
        @NotBlank private String productId;
        @Min(1) private int quantity;
    }
}