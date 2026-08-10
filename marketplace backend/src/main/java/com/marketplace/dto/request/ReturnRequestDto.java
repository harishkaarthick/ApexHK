package com.marketplace.dto.request;

import com.marketplace.enums.*;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
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

        // ISSUE-08 FIX: Changed from primitive int with @Min(1) to nullable Integer.
        //
        // Root cause: a primitive int deserialises to 0 when the field is absent from
        // the JSON body.  @Min(1) then rejected 0 with HTTP 400 *before* the service
        // was called, making the zero-equals-full-quantity path in ReturnService.create()
        // permanently unreachable.  Additionally, a primitive can never be null, so the
        // null-check added to the service was dead code.
        //
        // Fix: nullable Integer + no @Min constraint.
        //   - null  → caller omitted the field → service treats it as "return full qty"
        //   - 0     → treated the same as null (full qty) by the service
        //   - N > 0 → partial return; validated against purchased qty in the service
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
