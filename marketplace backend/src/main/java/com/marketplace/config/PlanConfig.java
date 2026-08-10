package com.marketplace.config;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * Subscription plan definitions.
 *
 * price          – amount in INR (0 for FREE)
 * productLimit   – max products; -1 means unlimited
 * commissionRate – platform commission percentage
 * validityDays   – subscription window from activation date
 */
@Getter
@RequiredArgsConstructor
public enum PlanConfig {

    FREE      (0,    10,  5.0,  30),
    BASIC     (499,  100, 3.0,  30),
    PREMIUM   (999,  -1,  2.0,  30),
    ENTERPRISE(2999, -1,  1.0,  30);

    private final int    price;
    private final int    productLimit;
    private final double commissionRate;
    private final int    validityDays;

    /** Case-insensitive lookup; throws {@link IllegalArgumentException} for unknown plans. */
    public static PlanConfig fromName(String name) {
        for (PlanConfig p : values()) {
            if (p.name().equalsIgnoreCase(name)) return p;
        }
        throw new IllegalArgumentException("Unknown subscription plan: " + name);
    }

    public boolean isFree() {
        return this == FREE;
    }
}
