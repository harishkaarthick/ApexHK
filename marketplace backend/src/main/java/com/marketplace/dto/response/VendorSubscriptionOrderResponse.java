package com.marketplace.dto.response;

import com.marketplace.enums.SubscriptionStatus;
import lombok.*;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VendorSubscriptionOrderResponse {
    private String id;
    private String plan;
    private long amount;         // INR paise
    private SubscriptionStatus status;
    private LocalDateTime createdAt;
    private LocalDateTime completedAt;
}
