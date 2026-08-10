package com.marketplace.dto.request;

import jakarta.validation.constraints.*;
import lombok.Data;

public class VendorRequest {

    @Data
    public static class UpdateStore {
        @Size(min = 2, max = 100) private String storeName;
        @Size(max = 500)          private String storeDescription;
    }

    @Data
    public static class Reject {
        @NotBlank private String reason;
    }

    @Data
    public static class UpdateCommission {
        @DecimalMin(value = "0.1", message = "Commission rate must be at least 0.1%")
        @DecimalMax(value = "100.0", message = "Commission rate cannot exceed 100%")
        private double commissionRate;
    }

    // ── Subscription ─────────────────────────────────────────────────────────
    @Data
    public static class SubscribePlan {
        @NotBlank(message = "Plan name is required")
        private String plan;  // FREE | BASIC | PREMIUM | ENTERPRISE
    }

    @Data
    public static class VerifySubscription {
        @NotBlank(message = "Plan name is required")
        private String plan;
        private String razorpayOrderId;
        private String razorpayPaymentId;
        private String razorpaySignature;
    }
}
