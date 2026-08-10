package com.marketplace.dto.response;

import com.marketplace.model.WalletTransaction;
import lombok.*;
import org.springframework.data.domain.Page;

public class WalletResponse {

    @Data
    @AllArgsConstructor
    public static class Balance {
        private double balance;
        // ISSUE-04 FIX: Changed from List<WalletTransaction> to Page<WalletTransaction>
        // to match the return type of WalletService.getTransactions(userId, pageable).
        // Page<T> does not extend List<T>, so the previous List field caused a
        // compile-time type error when WalletController passed a Page result here.
        private Page<WalletTransaction> transactions;
    }

    // Returned by POST /api/wallet/topup/create-order so the frontend can open
    // Razorpay Checkout. amount is in paise (smallest currency unit), matching
    // the shape Razorpay's SDK and the existing order-checkout flow both expect.
    @Data
    @AllArgsConstructor
    public static class TopupOrder {
        private String topupOrderId;
        private String razorpayOrderId;
        private long   amount;
        private String currency;
        private String key;
    }
}