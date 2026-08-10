package com.marketplace.dto.response;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class DashboardStats {
    private long totalUsers;
    private long totalVendors;
    private long pendingVendors;
    private long pendingPayouts;
    // Issue 2 fix: renamed from approvedPayouts → paidPayouts.
    // approvePayout() transitions PENDING → PAID directly; APPROVED is never written,
    // so the old "approvedPayouts" metric (APPROVED + PAID) was always equal to just PAID.
    // Renamed to paidPayouts to reflect what the count actually represents.
    private long paidPayouts;
    private double totalPayoutAmount;
    private long totalOrders;
    private double totalRevenue;
    private long totalProducts;
}