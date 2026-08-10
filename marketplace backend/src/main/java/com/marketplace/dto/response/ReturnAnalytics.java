package com.marketplace.dto.response;

import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReturnAnalytics {
    private long totalReturns;
    private long approvedReturns;
    private long rejectedReturns;
    private double refundAmount;
    private double returnRate;
}