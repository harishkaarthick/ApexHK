package com.marketplace.dto.request;

import com.marketplace.enums.OrderStatus;
import jakarta.validation.constraints.*;
import lombok.Data;

public class OrderRequest {

    @Data
    public static class Checkout {
        @NotBlank private String addressId;
        private String couponCode;
        // FIX H-1: A negative value caused the effective Razorpay amount to be
        // inflated (total - discount - (-x) = total - discount + x).  The wallet
        // debit path was skipped so the user paid more, not less — but the order
        // totals stored in the DB were incorrect.  @PositiveOrZero rejects any
        // negative value at the controller boundary before it reaches service logic.
        @PositiveOrZero private double walletAmountToUse;
    }

    @Data
    public static class VerifyPayment {
        @NotBlank private String razorpayOrderId;
        @NotBlank private String razorpayPaymentId;
        @NotBlank private String razorpaySignature;
    }

    @Data
    public static class UpdateStatus {
        @NotNull private OrderStatus status;
        private String reason;
    }

    @Data
    public static class AddTracking {
        @NotBlank private String trackingId;
    }

    @Data
    public static class UpdateShippingDetails {
        @NotBlank private String courierName;
        @NotBlank private String trackingNumber;
    }

    @Data
    public static class VerifyOtp {
        @NotBlank @Size(min = 6, max = 6) private String otp;
        // Which vendor's portion this OTP belongs to. Required for multi-vendor
        // orders; falls back to OTP-matching search if omitted (single-vendor orders).
        private String vendorId;
    }
}