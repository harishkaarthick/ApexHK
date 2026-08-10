package com.marketplace.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import lombok.Data;

public class WalletRequest {

    @Data
    public static class CreateTopup {
        @Positive(message = "Top-up amount must be greater than zero")
        private double amount;
    }

    @Data
    public static class VerifyTopup {
        @NotBlank private String razorpayOrderId;
        @NotBlank private String razorpayPaymentId;
        @NotBlank private String razorpaySignature;
    }
}
