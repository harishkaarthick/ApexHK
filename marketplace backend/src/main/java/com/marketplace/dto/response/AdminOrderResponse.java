package com.marketplace.dto.response;

import com.marketplace.enums.OrderStatus;
import com.marketplace.model.Address;
import com.marketplace.model.OrderItem;
import com.marketplace.model.VendorOrder;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminOrderResponse {
    private String id;
    private String customerId;
    private String customerName;
    private List<OrderItem> items;
    /** Full per-vendor breakdown, so admin can see which items/status belong to which vendor. */
    private List<VendorOrder> vendorOrders;
    private Address shippingAddress;
    private double total;
    private double totalAmount;
    private double discountAmount;
    private double walletAmountUsed;
    private double razorpayAmount;
    private String couponCode;
    private String razorpayOrderId;
    private String paymentId;
    private OrderStatus status;
    private String trackingId;
    private LocalDateTime placedAt;
    private LocalDateTime deliveredAt;
}
