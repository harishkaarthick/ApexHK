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

    @Bean
    public RazorpayClient razorpayClient() {
        String trimmedKeyId = normalize("razorpay.key-id", keyId);
        String trimmedKeySecret = normalize("razorpay.key-secret", keySecret);

        if (!trimmedKeyId.startsWith("rzp_test_")) {
            throw new IllegalStateException("Test Mode requires a Razorpay test key id starting with rzp_test_");
        }

        log.info("Razorpay Test Key ID loaded: {}", trimmedKeyId);
        log.info("Razorpay Secret loaded: {}", "*".repeat(Math.min(trimmedKeySecret.length(), 8)));

        try {
            return new RazorpayClient(trimmedKeyId, trimmedKeySecret);
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
}
