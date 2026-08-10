package com.marketplace.model;

import com.marketplace.enums.PayoutStatus;
import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "payout_requests")
public class PayoutRequest {

    @Id
    private String id;

    @Indexed
    private String vendorId;

    private double amount;

    @Builder.Default
    @Indexed
    private PayoutStatus status = PayoutStatus.PENDING;

    @Builder.Default
    private LocalDateTime requestedAt = LocalDateTime.now();

    private LocalDateTime processedAt;
    private String processedBy;
    private String rejectionReason;
}
