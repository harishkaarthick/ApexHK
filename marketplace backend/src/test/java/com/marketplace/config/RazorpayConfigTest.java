package com.marketplace.config;

import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class RazorpayConfigTest {

    @Test
    void testModeAcceptsTestKey() {
        RazorpayConfig config = config("test", "rzp_test_validkey", "secret");

        assertThatCode(config::razorpayClient).doesNotThrowAnyException();
    }

    @Test
    void liveModeAcceptsLiveKey() {
        RazorpayConfig config = config("live", "rzp_live_validkey", "secret");

        assertThatCode(config::razorpayClient).doesNotThrowAnyException();
    }

    @Test
    void invalidModeKeyCombinationIsRejected() {
        RazorpayConfig config = config("live", "rzp_test_validkey", "secret");

        assertThatThrownBy(config::razorpayClient)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Razorpay live mode requires a key id starting with rzp_live_");
    }

    @Test
    void invalidModeIsRejected() {
        RazorpayConfig config = config("sandbox", "rzp_test_validkey", "secret");

        assertThatThrownBy(config::razorpayClient)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("razorpay.mode must be either test or live");
    }

    private RazorpayConfig config(String mode, String keyId, String keySecret) {
        RazorpayConfig config = new RazorpayConfig();
        ReflectionTestUtils.setField(config, "mode", mode);
        ReflectionTestUtils.setField(config, "keyId", keyId);
        ReflectionTestUtils.setField(config, "keySecret", keySecret);
        return config;
    }
}
