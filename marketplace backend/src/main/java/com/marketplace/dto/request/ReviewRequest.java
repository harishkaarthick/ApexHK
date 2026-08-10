package com.marketplace.dto.request;

import jakarta.validation.constraints.*;
import lombok.Data;

public class ReviewRequest {

    @Data
    public static class Create {
        @NotBlank private String orderId;
        @NotBlank private String productId;
        @Min(1) @Max(5) private int rating;
        @NotBlank private String title;
        @NotBlank @Size(max = 1000) private String comment;
    }

}