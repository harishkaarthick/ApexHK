package com.marketplace.config;

import com.razorpay.RazorpayClient;
import com.razorpay.RazorpayException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.util.StringUtils;

@Slf4j
@Configuration
public class RazorpayConfig {

    @Value("${razorpay.key-id}")
    private String keyId;

    @Value("${razorpay.key-secret}")
    private String keySecret;

    @Value("${razorpay.mode:test}")
    private String mode;

    @Bean
    public RazorpayClient razorpayClient() {
        String trimmedKeyId = normalize("razorpay.key-id", keyId);
        String trimmedKeySecret = normalize("razorpay.key-secret", keySecret);
        String normalizedMode = normalizeMode(mode);

        String requiredPrefix = "test".equals(normalizedMode) ? "rzp_test_" : "rzp_live_";
        if (!trimmedKeyId.startsWith(requiredPrefix)) {
            throw new IllegalStateException(
                    "Razorpay " + normalizedMode + " mode requires a key id starting with " + requiredPrefix);
        }

        try {
            RazorpayClient client = new RazorpayClient(trimmedKeyId, trimmedKeySecret);
            log.info("Razorpay configuration loaded successfully");
            return client;
        } catch (RazorpayException e) {
            log.error("Failed to initialize Razorpay", e);
            throw new RuntimeException(e);
        }
    }

    private String normalize(String propertyName, String value) {
        if (!StringUtils.hasText(value) || value.startsWith("${")) {
            throw new IllegalStateException(propertyName + " is not configured. Set it in environment variables or marketplace backend/.env");
        }
        return value.trim();
    }

    private String normalizeMode(String value) {
        if (!StringUtils.hasText(value)) {
            throw new IllegalStateException("razorpay.mode must be either test or live");
        }
        String normalized = value.trim().toLowerCase();
        if (!normalized.equals("test") && !normalized.equals("live")) {
            throw new IllegalStateException("razorpay.mode must be either test or live");
        }
        return normalized;
    }
}
