package com.marketplace.enums;

public enum ReturnStatus {
    RETURN_REQUESTED,
    UNDER_REVIEW,
    APPROVED,
    REJECTED,
    PICKUP_SCHEDULED,
    PICKED_UP,
    RECEIVED_AT_WAREHOUSE,
    QUALITY_CHECK,
    REFUND_INITIATED,
    REFUNDED,
    APPEAL_REQUESTED,
    ADMIN_REVIEW,
    FINAL_APPROVED,
    FINAL_REJECTED,

    // Terminal state: item arrived at warehouse but failed the vendor's
    // quality check (e.g. wrong/damaged-by-customer item sent back). No
    // refund is issued and stock is NOT restored for this outcome.
    REJECTED_POST_QUALITY_CHECK
}
