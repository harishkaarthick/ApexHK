package com.marketplace.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DeliveryOtpResponse {
    private String orderId;
    private List<Entry> otps;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Entry {
        private String vendorId;
        private String vendorName;
        private String otp;
        private LocalDateTime generatedAt;
        private LocalDateTime expiresAt;
    }
}
