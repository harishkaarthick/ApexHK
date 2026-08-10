package com.marketplace.model;

import com.marketplace.enums.WalletTopupStatus;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

/**
 * Tracks a Razorpay order created for a wallet top-up.
 *
 * The wallet balance is only ever credited via WalletService once the payment
 * for one of these documents has been signature-verified (client redirect path)
 * or confirmed via the Razorpay webhook — never directly from a client-supplied
 * amount. See WalletService.createTopupOrder / verifyAndCredit / confirmTopupFromWebhook.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "wallet_topup_orders")
public class WalletTopupOrder {

    @Id
    private String id;

    @Indexed
    private String userId;

    /** Amount requested, in rupees. This is what the Razorpay order is created for. */
    private double amount;

    @Indexed(unique = true, sparse = true)
    private String razorpayOrderId;

    private String paymentId;

    @Builder.Default
    private WalletTopupStatus status = WalletTopupStatus.PENDING;

    @CreatedDate
    private LocalDateTime createdAt;

    private LocalDateTime completedAt;
}
