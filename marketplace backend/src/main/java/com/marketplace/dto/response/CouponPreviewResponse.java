package com.marketplace.dto.response;

import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CouponPreviewResponse {
    private String code;
    private double discount;
    private double totalAfterDiscount;
}
