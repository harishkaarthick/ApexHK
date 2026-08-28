package com.marketplace.util;

import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;

class RazorpayUtilTest {

    @Test
    void paymentSignatureUsesPaymentKeySecret() throws Exception {
        RazorpayUtil util = util("payment-secret", "webhook-secret");
        String signature = hmac("order-1|payment-1", "payment-secret");

        assertThat(util.verifyPaymentSignature("order-1", "payment-1", signature)).isTrue();
    }

    @Test
    void webhookSignatureUsesDedicatedWebhookSecret() throws Exception {
        RazorpayUtil util = util("payment-secret", "webhook-secret");
        String signature = hmac("{\"event\":\"payment.captured\"}", "webhook-secret");

        assertThat(util.verifyWebhookSignature("{\"event\":\"payment.captured\"}", signature)).isTrue();
    }

    @Test
    void webhookSignatureRejectsPaymentKeySecret() throws Exception {
        RazorpayUtil util = util("payment-secret", "webhook-secret");
        String signature = hmac("{\"event\":\"payment.captured\"}", "payment-secret");

        assertThat(util.verifyWebhookSignature("{\"event\":\"payment.captured\"}", signature)).isFalse();
    }

    @Test
    void missingWebhookSecretRejectsWebhookSignature() throws Exception {
        RazorpayUtil util = util("payment-secret", "");
        String signature = hmac("{\"event\":\"payment.captured\"}", "payment-secret");

        assertThat(util.verifyWebhookSignature("{\"event\":\"payment.captured\"}", signature)).isFalse();
    }

    private RazorpayUtil util(String keySecret, String webhookSecret) {
        RazorpayUtil util = new RazorpayUtil();
        ReflectionTestUtils.setField(util, "keySecret", keySecret);
        ReflectionTestUtils.setField(util, "webhookSecret", webhookSecret);
        return util;
    }

    private String hmac(String payload, String secret) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        byte[] hash = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
        StringBuilder hex = new StringBuilder(hash.length * 2);
        for (byte b : hash) {
            hex.append(String.format("%02x", b));
        }
        return hex.toString();
    }
}
