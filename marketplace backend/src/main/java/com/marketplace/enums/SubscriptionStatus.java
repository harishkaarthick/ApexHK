package com.marketplace.enums;

public enum SubscriptionStatus {
    PENDING,    // Razorpay order created, payment not yet confirmed
    ACTIVE,     // payment confirmed, within validity window
    EXPIRED,    // validity window passed, not renewed
    CANCELLED,  // vendor or admin cancelled before expiry
    FAILED      // payment failed / abandoned
}
