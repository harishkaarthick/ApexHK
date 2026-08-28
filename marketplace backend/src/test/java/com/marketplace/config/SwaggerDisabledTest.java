package com.marketplace.config;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "JWT_SECRET=test-jwt-secret-that-is-long-enough-for-hs512",
        "RAZORPAY_KEY_ID=rzp_test_contextload",
        "RAZORPAY_KEY_SECRET=test_key_secret",
        "RAZORPAY_WEBHOOK_SECRET=test_webhook_secret",
        "SPRINGDOC_ENABLED=false"
})
@AutoConfigureMockMvc
class SwaggerDisabledTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void apiDocsAreUnavailableWhenSpringdocDisabled() throws Exception {
        mockMvc.perform(get("/api-docs"))
                .andExpect(status().isNotFound());
    }
}
