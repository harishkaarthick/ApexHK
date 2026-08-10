package com.marketplace.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

public class CategoryRequest {

    @Data
    public static class Create {
        @NotBlank
        @Size(max = 80)
        private String name;
    }
}
