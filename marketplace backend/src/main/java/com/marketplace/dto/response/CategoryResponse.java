package com.marketplace.dto.response;

import com.marketplace.enums.CategoryStatus;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class CategoryResponse {
    private String id;
    private String name;
    private String slug;
    private CategoryStatus status;
    private String requestedByVendorId;
    private LocalDateTime createdAt;
}
