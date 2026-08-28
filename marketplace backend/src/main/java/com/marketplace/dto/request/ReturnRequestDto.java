package com.marketplace.dto.request;

import com.marketplace.enums.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Data;

import java.util.List;

public class ReturnRequestDto {

    @Data
    public static class Create {
        @NotBlank private String orderId;
        @NotBlank private String orderItemId;
        @NotNull private ReturnReason reason;
        private String description;
        private List<String> evidenceImageUrls;

        // Null preserves the existing API behavior: omitted quantity means full return.
        // Explicit zero or negative values are invalid.
        @Positive
        private Integer quantityToReturn;
    }

    @Data
    public static class Reject {
        @NotBlank private String reason;
    }

    @Data
    public static class PickupSchedule {
        @NotBlank private String pickupDate;
        @NotBlank private String pickupAddress;
    }

    @Data
    public static class UpdateStatus {
        @NotNull private ReturnStatus status;
        private String trackingNumber;
    }

    @Data
    public static class QualityCheck {
        @NotNull private Boolean passed;
        private String notes;
    }

    @Data
    public static class Refund {
        @NotNull private RefundMethod refundMethod;
    }

    @Data
    public static class Appeal {
        @NotBlank private String appealReason;
    }
}
