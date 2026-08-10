package com.marketplace.dto.response;

import com.marketplace.enums.PayoutStatus;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class PayoutRequestResponse {
    private String id;
    private String vendorId;
    private String vendorName;
    private double amount;
    private PayoutStatus status;
    private LocalDateTime requestedAt;
    private LocalDateTime processedAt;
    private String processedBy;
    private String rejectionReason;
}
