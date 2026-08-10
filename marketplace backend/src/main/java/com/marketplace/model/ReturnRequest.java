package com.marketplace.model;

import com.marketplace.enums.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "return_requests")
public class ReturnRequest {

    @Id
    private String id;

    @Indexed
    private String orderId;

    private String orderItemId;
    private String customerId;
    private String vendorId;
    private ReturnReason reason;
    private String description;
    private List<String> evidenceImages;

    @Builder.Default
    private ReturnStatus status = ReturnStatus.RETURN_REQUESTED;

    private String rejectionReason;
    private String pickupDate;
    private String pickupAddress;
    private String trackingNumber;
    private RefundMethod refundMethod;
    private double refundAmount;

    // FIX C-4: Store the quantity being returned so stock can be restored correctly
    // when the vendor approves the return.  Without this the stock increment in
    // ReturnService.approve() would have no basis for the correct delta.
    @Builder.Default
    private int quantity = 1;

    private String razorpayRefundId;

    @CreatedDate
    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
    private LocalDateTime resolvedAt;

    // Additional fields for enhanced return management
    private String appealReason;
    private String adminResolutionReason;
    private String productId;
    private String productName;

    // Quality-check outcome, recorded when the vendor inspects the returned
    // item at the warehouse. null = not yet inspected. true = passed (refund
    // may proceed). false = failed (return is rejected post-receipt, no
    // refund, no stock restoration).
    private Boolean qualityCheckPassed;
    private String qualityCheckNotes;

    // Set once stock has actually been restored for this return, so the
    // increment can never be applied twice even under retries/races.
    @Builder.Default
    private boolean stockRestored = false;

    // Set once the vendor's commission/earnings have been reversed for this
    // return, guarding against double-reversal for the same reason.
    @Builder.Default
    private boolean commissionReversed = false;
}
