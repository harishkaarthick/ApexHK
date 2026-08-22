package com.marketplace;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest(properties = {
		"JWT_SECRET=test-jwt-secret-that-is-long-enough-for-hs512",
		"RAZORPAY_KEY_ID=rzp_test_contextload",
		"RAZORPAY_KEY_SECRET=test_key_secret"
})
class MarketplaceApiApplicationTests {

	@Test
	void contextLoads() {
	}

}
