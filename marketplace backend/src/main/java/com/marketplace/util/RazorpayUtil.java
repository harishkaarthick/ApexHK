package com.marketplace.util;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;

@Slf4j
@Component
public class RazorpayUtil {

    @Value("${razorpay.key-secret}")
    private String keySecret;

    /**
     * Verifies the Razorpay webhook/payment signature.
     * Payload format: razorpayOrderId + "|" + razorpayPaymentId
     */
    public boolean verifyPaymentSignature(String razorpayOrderId,
                                          String razorpayPaymentId,
                                          String signature) {
        return verifyHmac(razorpayOrderId + "|" + razorpayPaymentId, signature);
    }

    /**
     * Verifies a Razorpay webhook signature.
     * Payload is the raw webhook request body string.
     */
    public boolean verifyWebhookSignature(String payload, String signature) {
        return verifyHmac(payload, signature);
    }

    private boolean verifyHmac(String payload, String signature) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(
                    keySecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] hash = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder(hash.length * 2);
            for (byte b : hash) hex.append(String.format("%02x", b));
            return hex.toString().equals(signature);
        } catch (Exception e) {
            log.error("HMAC verification error: {}", e.getMessage());
            return false;
        }
    }
}