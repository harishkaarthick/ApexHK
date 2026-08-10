package com.marketplace.dto.response;

import com.marketplace.enums.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.List;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class ReturnResponse {
    private String id;
    private String orderId;
    private String orderItemId;
    private String customerId;
    private String vendorId;
    private ReturnReason reason;
    private String description;
    private List<String> evidenceImages;
    private ReturnStatus status;
    private String rejectionReason;
    private String pickupDate;
    private String pickupAddress;
    private String trackingNumber;
    private RefundMethod refundMethod;
    private double refundAmount;
    private String razorpayRefundId;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private LocalDateTime resolvedAt;
    private String productId;
    private String productName;
    private Boolean qualityCheckPassed;
    private String qualityCheckNotes;

    // Enriched fields for the vendor return-detail view (looked up from the
    // parent Order/OrderItem and User at response-build time; not persisted
    // on ReturnRequest itself).
    private String productImage;
    private int quantity;
    private double unitPrice;
    private String customerName;
    private String customerEmail;
}