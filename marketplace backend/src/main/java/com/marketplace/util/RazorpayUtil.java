package com.marketplace.util;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.security.MessageDigest;
import java.nio.charset.StandardCharsets;
import org.springframework.util.StringUtils;

@Slf4j
@Component
public class RazorpayUtil {

    @Value("${razorpay.key-secret}")
    private String keySecret;

    @Value("${razorpay.webhook-secret}")
    private String webhookSecret;

    /**
     * Verifies the Razorpay webhook/payment signature.
     * Payload format: razorpayOrderId + "|" + razorpayPaymentId
     */
    public boolean verifyPaymentSignature(String razorpayOrderId,
                                          String razorpayPaymentId,
                                          String signature) {
        return verifyHmac(razorpayOrderId + "|" + razorpayPaymentId, signature, keySecret);
    }

    /**
     * Verifies a Razorpay webhook signature.
     * Payload is the raw webhook request body string.
     */
    public boolean verifyWebhookSignature(String payload, String signature) {
        return verifyHmac(payload, signature, webhookSecret);
    }

    private boolean verifyHmac(String payload, String signature, String secret) {
        if (!StringUtils.hasText(signature) || !StringUtils.hasText(secret)) {
            return false;
        }
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(
                    secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] hash = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder(hash.length * 2);
            for (byte b : hash) hex.append(String.format("%02x", b));
            return MessageDigest.isEqual(
                    hex.toString().getBytes(StandardCharsets.UTF_8),
                    signature.getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) {
            log.error("HMAC verification error: {}", e.getMessage());
            return false;
        }
    }
}
