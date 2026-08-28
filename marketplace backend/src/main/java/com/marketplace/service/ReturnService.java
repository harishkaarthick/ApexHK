package com.marketplace.service;

import com.marketplace.dto.request.ReturnRequestDto;
import com.marketplace.dto.response.*;
import com.marketplace.enums.*;
import com.marketplace.exception.*;
import com.marketplace.model.*;
import com.marketplace.repository.*;
import com.marketplace.util.CloudinaryUploader;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.json.JSONObject;
import org.springframework.data.domain.*;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import com.razorpay.RazorpayClient;
import com.razorpay.RazorpayException;
import com.razorpay.Refund;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class ReturnService {

    private final ReturnRepository returnRepository;
    private final OrderRepository orderRepository;
    private final UserRepository userRepository;
    private final WalletService walletService;
    private final NotificationService notificationService;
    private final EmailService emailService;
    private final RazorpayClient razorpayClient;
    private final MongoTemplate mongoTemplate;
    private final CloudinaryUploader cloudinaryUploader;

    /** Spec: only allow return requests within 7 days of deliveredAt */
    private static final int RETURN_WINDOW_DAYS = 7;

    public ReturnResponse create(String customerId, ReturnRequestDto.Create req) {
        return create(customerId, req, null);
    }

    /**
     * Customer return creation with optional evidence photos. Images are uploaded to
     * Cloudinary under "returns/{orderId}" and their secure URLs are stored alongside
     * any evidenceImageUrls already present on the request (kept for backward
     * compatibility with API clients that already host their own image URLs).
     */
    public ReturnResponse create(String customerId, ReturnRequestDto.Create req, List<MultipartFile> evidenceImages) {
        Order order = orderRepository.findById(req.getOrderId())
                .orElseThrow(() -> new ResourceNotFoundException("Order", req.getOrderId()));

        if (!order.getCustomerId().equals(customerId))
            throw new UnauthorizedException("Not your order");

        OrderItem orderItem = order.getItems().stream()
                .filter(oi -> req.getOrderItemId().equals(oi.getId()))
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("OrderItem", req.getOrderItemId()));

        // Return eligibility must be checked against THIS item's own vendor's
        // fulfillment state, not the parent order's aggregate status/deliveredAt.
        // The parent only reaches DELIVERED once every vendor on the order has
        // delivered, so on a multi-vendor order an item whose vendor delivered
        // days ago would otherwise be blocked from returns (or granted the wrong
        // 7-day window) while waiting on an unrelated vendor's shipment.
        VendorOrder ownerVendorOrder = order.getVendorOrders() == null || order.getVendorOrders().isEmpty()
                || orderItem.getVendorId() == null
                ? null
                : order.getVendorOrders().stream()
                        .filter(vo -> orderItem.getVendorId().equals(vo.getVendorId()))
                        .findFirst()
                        .orElse(null);
        OrderStatus itemStatus = ownerVendorOrder != null ? ownerVendorOrder.getStatus() : order.getStatus();
        LocalDateTime itemDeliveredAt = ownerVendorOrder != null ? ownerVendorOrder.getDeliveredAt() : order.getDeliveredAt();

        if (itemStatus != OrderStatus.DELIVERED)
            throw new IllegalStateException("Only delivered orders can be returned");

        if (itemDeliveredAt == null)
            throw new IllegalStateException("Order delivery date is not recorded");

        LocalDateTime returnDeadline = itemDeliveredAt.plusDays(RETURN_WINDOW_DAYS);
        if (LocalDateTime.now().isAfter(returnDeadline))
            throw new IllegalStateException(
                    "Return window has closed. Returns must be raised within "
                            + RETURN_WINDOW_DAYS + " days of delivery.");

        // Prevent duplicate return requests for the exact same item in the same
        // order — but only while a prior return for that item is still active.
        // A REJECTED / FINAL_REJECTED / REJECTED_POST_QUALITY_CHECK return must
        // not permanently block the customer from ever raising a return again
        // for that item (e.g. after winning an appeal, or simply being allowed
        // to re-file within the window).
        boolean hasActiveReturn = returnRepository
                .findByOrderItemIdAndCustomerId(orderItem.getId(), customerId)
                .stream()
                .anyMatch(r -> r.getStatus() != ReturnStatus.REJECTED
                        && r.getStatus() != ReturnStatus.FINAL_REJECTED
                        && r.getStatus() != ReturnStatus.REJECTED_POST_QUALITY_CHECK);
        if (hasActiveReturn)
            throw new IllegalStateException(
                    "A return request already exists for this item in order " + req.getOrderId());

        // Calculate refund amount based on quantity
        if (req.getQuantityToReturn() != null && req.getQuantityToReturn() <= 0) {
            throw new IllegalStateException("Return quantity must be greater than zero");
        }
        int qtyToReturn = req.getQuantityToReturn() == null
                ? orderItem.getQuantity()
                : req.getQuantityToReturn();
        if (qtyToReturn > orderItem.getQuantity())
            throw new IllegalStateException(
                    "Cannot return " + qtyToReturn + " units; only "
                            + orderItem.getQuantity() + " were purchased");

        double unitPrice = orderItem.getTotalPrice() / orderItem.getQuantity();
        double refundAmount = unitPrice * qtyToReturn;

        List<String> evidenceUrls = new ArrayList<>();
        if (req.getEvidenceImageUrls() != null) evidenceUrls.addAll(req.getEvidenceImageUrls());
        evidenceUrls.addAll(uploadEvidenceImages(evidenceImages, req.getOrderId()));

        ReturnRequest rr = returnRepository.save(ReturnRequest.builder()
                .orderId(req.getOrderId())
                .orderItemId(req.getOrderItemId())
                .customerId(customerId)
                .vendorId(orderItem.getVendorId())
                .productId(orderItem.getProductId())
                .productName(orderItem.getProductName())
                .reason(req.getReason())
                .description(req.getDescription())
                .evidenceImages(evidenceUrls)
                .refundAmount(refundAmount)
                .quantity(qtyToReturn)
                .build());

        // Update order item to mark return as requested
        // Find the order and update the specific order item
        boolean itemFound = false;
        for (OrderItem item : order.getItems()) {
            if (req.getOrderItemId().equals(item.getId())) {
                if (item.isReturnRequest())
                    throw new IllegalStateException("Return already requested for this item");
                item.setReturnRequest(true);
                itemFound = true;
                break;
            }
        }
        
        if (!itemFound) {
            throw new ResourceNotFoundException("OrderItem", orderItem.getProductId());
        }

        // Save the updated order
        orderRepository.save(order);

        notificationService.send(orderItem.getVendorId(), "Return Request",
                "Return raised for " + orderItem.getProductName(),
                "RETURN_REQUESTED", rr.getId());
        return toResponse(rr);
    }

    public ReturnResponse getById(String returnId) {
        return returnRepository.findById(returnId)
                .map(this::toResponse)
                .orElseThrow(() -> new ResourceNotFoundException("ReturnRequest", returnId));
    }

    // Vendor-scoped lookup for the return detail view — 404s (via
    // ResourceNotFoundException, not Unauthorized) for returns belonging to
    // another vendor so we don't leak which return IDs exist.
    public ReturnResponse getVendorReturnById(String returnId, String vendorId) {
        ReturnRequest existing = findById(returnId);
        if (!existing.getVendorId().equals(vendorId))
            throw new ResourceNotFoundException("ReturnRequest", returnId);
        return toResponse(existing);
    }

    public ReturnResponse vendorReview(String returnId, String vendorId,
                                      ReturnRequestDto.UpdateStatus req) {
        ReturnRequest existing = findById(returnId);
        if (!existing.getVendorId().equals(vendorId))
            throw new UnauthorizedException("Not your return");

        if (existing.getStatus() != ReturnStatus.RETURN_REQUESTED)
            throw new IllegalStateException(
                    "Return is already in status " + existing.getStatus()
                            + " and cannot be reviewed");

        // Transition to UNDER_REVIEW
        existing.setStatus(ReturnStatus.UNDER_REVIEW);
        existing.setUpdatedAt(LocalDateTime.now());
        returnRepository.save(existing);

        notificationService.send(existing.getCustomerId(), "Return Under Review",
                "Your return request is under review by the vendor.",
                "RETURN_UNDER_REVIEW", existing.getId());

        return toResponse(existing);
    }

    public ReturnResponse vendorApprove(String returnId, String vendorId) {
        ReturnRequest existing = findById(returnId);
        if (!existing.getVendorId().equals(vendorId))
            throw new UnauthorizedException("Not your return");

        if (existing.getStatus() != ReturnStatus.UNDER_REVIEW)
            throw new IllegalStateException(
                    "Return is already in status " + existing.getStatus()
                            + " and cannot be approved");

        // Transition to APPROVED
        existing.setStatus(ReturnStatus.APPROVED);
        existing.setUpdatedAt(LocalDateTime.now());
        returnRepository.save(existing);

        notificationService.send(existing.getCustomerId(), "Return Approved",
                "Your return request has been approved. Pickup will be scheduled soon.",
                "RETURN_APPROVED", existing.getId());

        return toResponse(existing);
    }

    public ReturnResponse vendorReject(String returnId, String vendorId,
                                      ReturnRequestDto.Reject req) {
        ReturnRequest existing = findById(returnId);
        if (!existing.getVendorId().equals(vendorId))
            throw new UnauthorizedException("Not your return");

        if (existing.getStatus() != ReturnStatus.UNDER_REVIEW)
            throw new IllegalStateException(
                    "Return is already in status " + existing.getStatus()
                            + " and cannot be rejected");

        // Transition to REJECTED
        existing.setStatus(ReturnStatus.REJECTED);
        existing.setRejectionReason(req.getReason());
        existing.setResolvedAt(LocalDateTime.now());
        existing.setUpdatedAt(LocalDateTime.now());
        returnRepository.save(existing);

        // Restore only the exact order item tied to this return. Matching by
        // productId is unsafe when the same product appears more than once.
        resetOrderItemReturnFlag(existing.getOrderId(), existing.getOrderItemId());

        notificationService.send(existing.getCustomerId(), "Return Rejected",
                req.getReason(), "RETURN_REJECTED", existing.getId());

        return toResponse(existing);
    }

    public ReturnResponse vendorSchedulePickup(String returnId, String vendorId,
                                              ReturnRequestDto.PickupSchedule req) {
        ReturnRequest existing = findById(returnId);
        if (!existing.getVendorId().equals(vendorId))
            throw new UnauthorizedException("Not your return");

        if (existing.getStatus() != ReturnStatus.APPROVED)
            throw new IllegalStateException(
                    "Return is already in status " + existing.getStatus()
                            + " and cannot schedule pickup");

        // Transition to PICKUP_SCHEDULED
        existing.setStatus(ReturnStatus.PICKUP_SCHEDULED);
        existing.setPickupDate(req.getPickupDate());
        existing.setPickupAddress(req.getPickupAddress());
        existing.setUpdatedAt(LocalDateTime.now());
        returnRepository.save(existing);

        notificationService.send(existing.getCustomerId(), "Pickup Scheduled",
                "Your pickup has been scheduled for " + req.getPickupDate() + ".\nAddress: " + req.getPickupAddress(),
                "PICKUP_SCHEDULED", existing.getId());

        return toResponse(existing);
    }

    public ReturnResponse vendorMarkPickedUp(String returnId, String vendorId) {
        ReturnRequest existing = findById(returnId);
        if (!existing.getVendorId().equals(vendorId))
            throw new UnauthorizedException("Not your return");

        if (existing.getStatus() != ReturnStatus.PICKUP_SCHEDULED)
            throw new IllegalStateException(
                    "Return is already in status " + existing.getStatus()
                            + " and cannot be marked as picked up");

        // Transition to PICKED_UP
        existing.setStatus(ReturnStatus.PICKED_UP);
        existing.setUpdatedAt(LocalDateTime.now());
        returnRepository.save(existing);

        notificationService.send(existing.getCustomerId(), "Picked Up",
                "Your return has been picked up and is on its way to the warehouse.",
                "PICKED_UP", existing.getId());

        return toResponse(existing);
    }

    public ReturnResponse vendorMarkReceived(String returnId, String vendorId) {
        ReturnRequest existing = findById(returnId);
        if (!existing.getVendorId().equals(vendorId))
            throw new UnauthorizedException("Not your return");

        if (existing.getStatus() != ReturnStatus.PICKED_UP)
            throw new IllegalStateException(
                    "Return is already in status " + existing.getStatus()
                            + " and cannot be marked as received");

        // Transition to RECEIVED_AT_WAREHOUSE
        existing.setStatus(ReturnStatus.RECEIVED_AT_WAREHOUSE);
        existing.setUpdatedAt(LocalDateTime.now());
        returnRepository.save(existing);

        notificationService.send(existing.getCustomerId(), "Received at Warehouse",
                "Your return has been received at our warehouse and is undergoing quality check.",
                "RECEIVED_AT_WAREHOUSE", existing.getId());

        return toResponse(existing);
    }

    public ReturnResponse vendorQualityCheck(String returnId, String vendorId,
                                            ReturnRequestDto.QualityCheck req) {
        ReturnRequest existing = findById(returnId);
        if (!existing.getVendorId().equals(vendorId))
            throw new UnauthorizedException("Not your return");

        if (existing.getStatus() != ReturnStatus.RECEIVED_AT_WAREHOUSE)
            throw new IllegalStateException(
                    "Return is already in status " + existing.getStatus()
                            + " and cannot be marked as quality checked");

        boolean passed = req != null && Boolean.TRUE.equals(req.getPassed());
        existing.setQualityCheckPassed(passed);
        existing.setQualityCheckNotes(req != null ? req.getNotes() : null);
        existing.setUpdatedAt(LocalDateTime.now());

        if (passed) {
            // Transition to QUALITY_CHECK (passed) — refund can now be initiated.
            existing.setStatus(ReturnStatus.QUALITY_CHECK);
            returnRepository.save(existing);

            notificationService.send(existing.getCustomerId(), "Quality Check",
                    "Your return passed quality check. Refund will be processed soon.",
                    "QUALITY_CHECK", existing.getId());
        } else {
            // Failed inspection is terminal: no refund, no stock restoration,
            // and the order item is freed up so the customer isn't blocked
            // from raising a fresh return later.
            existing.setStatus(ReturnStatus.REJECTED_POST_QUALITY_CHECK);
            existing.setResolvedAt(LocalDateTime.now());
            returnRepository.save(existing);
            resetOrderItemReturnFlag(existing.getOrderId(), existing.getOrderItemId());

            notificationService.send(existing.getCustomerId(), "Return Rejected",
                    "Your returned item failed our quality check and could not be refunded."
                            + (req != null && req.getNotes() != null ? " Reason: " + req.getNotes() : ""),
                    "RETURN_REJECTED_QC", existing.getId());
        }

        return toResponse(existing);
    }

    public ReturnResponse initiateRefund(String returnId, String vendorId,
                                        ReturnRequestDto.Refund req) {
        ReturnRequest existing = findById(returnId);
        if (!existing.getVendorId().equals(vendorId))
            throw new UnauthorizedException("Not your return");

        if (existing.getStatus() != ReturnStatus.QUALITY_CHECK)
            throw new IllegalStateException(
                    "Return is already in status " + existing.getStatus()
                            + " and cannot initiate refund");

        if (existing.getQualityCheckPassed() == null || !existing.getQualityCheckPassed())
            throw new IllegalStateException("Refund cannot be initiated before a passing quality check");

        // Transition to REFUND_INITIATED
        existing.setStatus(ReturnStatus.REFUND_INITIATED);
        existing.setRefundMethod(req.getRefundMethod());
        existing.setUpdatedAt(LocalDateTime.now());
        returnRepository.save(existing);

        notificationService.send(existing.getCustomerId(), "Refund Initiated",
                "Your refund has been initiated. It will be processed within 3-5 business days.",
                "REFUND_INITIATED", existing.getId());

        return toResponse(existing);
    }

    /**
     * Wallet transaction label shown to the customer on the Wallet page.
     * Explicitly calls out "Product return" plus the product name so it
     * reads clearly in the transaction list rather than a bare order id.
     */
    private String productReturnDescription(ReturnRequest r) {
        String product = r.getProductName() != null && !r.getProductName().isBlank()
                ? r.getProductName() : ("order " + r.getOrderId());
        return "Product return refund - " + product;
    }

    public ReturnResponse completeRefund(String returnId, String vendorId) {
        ReturnRequest snapshot = findById(returnId);
        if (!snapshot.getVendorId().equals(vendorId))
            throw new UnauthorizedException("Not your return");

        // Atomic guard: only one caller can ever flip REFUND_INITIATED ->
        // REFUNDED for this document. Concurrent double-clicks/retries on
        // this endpoint will have every call but the first return null here,
        // which prevents a duplicate Razorpay refund / double wallet credit.
        Query claim = Query.query(Criteria.where("_id").is(returnId)
                .and("status").is(ReturnStatus.REFUND_INITIATED));
        Update claimUpdate = new Update()
                .set("status", ReturnStatus.REFUNDED)
                .set("resolvedAt", LocalDateTime.now())
                .set("updatedAt", LocalDateTime.now());
        ReturnRequest existing = mongoTemplate.findAndModify(
                claim, claimUpdate,
                org.springframework.data.mongodb.core.FindAndModifyOptions.options().returnNew(true),
                ReturnRequest.class);

        if (existing == null)
            throw new IllegalStateException(
                    "Return is already in status " + snapshot.getStatus()
                            + " and cannot be completed");

        // Process refund based on method
        if (existing.getRefundMethod() == RefundMethod.ORIGINAL_PAYMENT) {
            // Process Razorpay refund
            Order order = orderRepository.findById(existing.getOrderId()).orElse(null);
            if (order != null && order.getPaymentId() != null) {
                try {
                    JSONObject opts = new JSONObject();
                    opts.put("amount", (int) (existing.getRefundAmount() * 100));
                    Refund refund = razorpayClient.payments.refund(order.getPaymentId(), opts);
                    existing.setRazorpayRefundId(refund.get("id"));
                    returnRepository.save(existing);
                } catch (RazorpayException e) {
                    log.warn("Razorpay refund failed for return {}: {}", existing.getId(), e.getMessage());
                    // Fallback to wallet credit
                    walletService.credit(existing.getCustomerId(), existing.getRefundAmount(),
                            productReturnDescription(existing), existing.getId());
                }
            } else {
                // No Razorpay payment (wallet-only order) — credit wallet directly
                walletService.credit(existing.getCustomerId(), existing.getRefundAmount(),
                        productReturnDescription(existing), existing.getId());
            }
        } else if (existing.getRefundMethod() == RefundMethod.WALLET_CREDIT) {
            walletService.credit(existing.getCustomerId(), existing.getRefundAmount(),
                    productReturnDescription(existing), existing.getId());
        } else if (existing.getRefundMethod() == RefundMethod.STORE_CREDIT) {
            // Store credit logic would go here
            walletService.credit(existing.getCustomerId(), existing.getRefundAmount(),
                    productReturnDescription(existing), existing.getId());
        }

        // Restore stock and reverse the vendor's commission/earnings for the
        // returned quantity. Both are guarded by their own idempotency flags
        // (stockRestored / commissionReversed) on the ReturnRequest document
        // so retries of this method — or the failure fallback above — can
        // never double-apply either effect.
        restoreStockIfNeeded(existing);
        reverseVendorEarningsIfNeeded(existing);

        notificationService.send(existing.getCustomerId(), "Refund Completed",
                "Your refund has been completed. Amount has been credited to your " + existing.getRefundMethod() + ".",
                "REFUND_COMPLETED", existing.getId());

        userRepository.findById(existing.getCustomerId()).ifPresent(u ->
                emailService.sendRefundConfirmation(
                        u.getEmail(), u.getName(), existing.getRefundAmount()));

        return toResponse(existing);
    }

    /**
     * Restores stock for the returned quantity via an atomic $inc, guarded by
     * a one-time flip of ReturnRequest.stockRestored so it can never be
     * applied twice for the same return (e.g. on a retried call).
     */
    private void restoreStockIfNeeded(ReturnRequest existing) {
        Query claim = Query.query(Criteria.where("_id").is(existing.getId())
                .and("stockRestored").is(false));
        Update claimUpdate = new Update().set("stockRestored", true);
        ReturnRequest claimed = mongoTemplate.findAndModify(
                claim, claimUpdate,
                org.springframework.data.mongodb.core.FindAndModifyOptions.options().returnNew(true),
                ReturnRequest.class);
        if (claimed == null) return; // already restored by a prior call

        mongoTemplate.updateFirst(
                Query.query(Criteria.where("_id").is(existing.getProductId())),
                new Update().inc("stock", existing.getQuantity()),
                Product.class);
    }

    /**
     * Reverses the vendor's commission/earnings for the returned quantity,
     * mirroring the same proportional calculation OrderService uses when it
     * first credits them. Guarded by commissionReversed so a retry can never
     * double-reverse. Scoped strictly to this return's own vendorId, so a
     * Vendor A refund can never touch Vendor B's earnings.
     */
    private void reverseVendorEarningsIfNeeded(ReturnRequest existing) {
        Query claim = Query.query(Criteria.where("_id").is(existing.getId())
                .and("commissionReversed").is(false));
        Update claimUpdate = new Update().set("commissionReversed", true);
        ReturnRequest claimed = mongoTemplate.findAndModify(
                claim, claimUpdate,
                org.springframework.data.mongodb.core.FindAndModifyOptions.options().returnNew(true),
                ReturnRequest.class);
        if (claimed == null) return; // already reversed by a prior call

        double refundAmount = existing.getRefundAmount();
        if (refundAmount <= 0) return;

        Vendor vendor = null;
        try {
            vendor = mongoTemplate.findById(existing.getVendorId(), Vendor.class);
        } catch (Exception e) {
            log.warn("Could not load vendor {} to reverse earnings for return {}",
                    existing.getVendorId(), existing.getId());
        }
        if (vendor == null) return;

        double commission = refundAmount * vendor.getCommissionRate() / 100;
        double vendorShare = refundAmount - commission;

        // Never let pendingPayout go negative if it's already been paid out
        // (an admin-approved payout can zero it before a refund lands).
        Query sufficientPayout = Query.query(Criteria.where("_id").is(existing.getVendorId())
                .and("pendingPayout").gte(vendorShare));
        Update fullDecrease = new Update()
                .inc("totalEarnings", -vendorShare)
                .inc("pendingPayout", -vendorShare);
        Vendor matched = mongoTemplate.findAndModify(sufficientPayout, fullDecrease, Vendor.class);

        if (matched == null) {
            mongoTemplate.updateFirst(
                    Query.query(Criteria.where("_id").is(existing.getVendorId())),
                    new Update()
                            .inc("totalEarnings", -vendorShare)
                            .set("pendingPayout", 0),
                    Vendor.class);
        }
    }

    public ReturnResponse customerAppeal(String returnId, String customerId,
                                       ReturnRequestDto.Appeal req) {
        ReturnRequest existing = findById(returnId);
        if (!existing.getCustomerId().equals(customerId))
            throw new UnauthorizedException("Not your return");

        if (existing.getStatus() != ReturnStatus.REJECTED)
            throw new IllegalStateException(
                    "Return is already in status " + existing.getStatus()
                            + " and cannot be appealed");

        // Transition to APPEAL_REQUESTED
        existing.setStatus(ReturnStatus.APPEAL_REQUESTED);
        existing.setAppealReason(req.getAppealReason());
        existing.setUpdatedAt(LocalDateTime.now());
        returnRepository.save(existing);

notificationService.send(existing.getVendorId(), "Return Appeal",
                "Customer has appealed a rejected return request for order " + existing.getOrderId() + ".\\nReason: " + req.getAppealReason(),
                "RETURN_APPEAL", existing.getId());

        return toResponse(existing);
    }

    public ReturnResponse adminResolveAppeal(String returnId, String adminId,
                                           ReturnStatus newStatus, String resolutionReason) {
        ReturnRequest existing = findById(returnId);

        if (existing.getStatus() != ReturnStatus.APPEAL_REQUESTED)
            throw new IllegalStateException(
                    "Return is already in status " + existing.getStatus()
                            + " and cannot be resolved");

        if (newStatus != ReturnStatus.FINAL_APPROVED && newStatus != ReturnStatus.FINAL_REJECTED)
            throw new IllegalStateException("Invalid final status for appeal resolution");

        // Transition to final status
        existing.setStatus(newStatus);
        existing.setRejectionReason(resolutionReason);
        existing.setAdminResolutionReason(resolutionReason);
        existing.setResolvedAt(LocalDateTime.now());
        existing.setUpdatedAt(LocalDateTime.now());
        returnRepository.save(existing);

        if (newStatus == ReturnStatus.FINAL_APPROVED) {
            notificationService.send(existing.getCustomerId(), "Appeal Approved",
                    "Your appeal has been approved. The return will be processed again.",
                    "APPEAL_APPROVED", existing.getId());
        } else {
            // Final rejection is terminal — free up the order item so the
            // customer isn't permanently blocked from ever returning it again.
            resetOrderItemReturnFlag(existing.getOrderId(), existing.getOrderItemId());
            notificationService.send(existing.getCustomerId(), "Appeal Rejected",
                    "Your appeal has been rejected. " + resolutionReason,
                    "APPEAL_REJECTED", existing.getId());
        }

        return toResponse(existing);
    }



    public PagedResponse<ReturnResponse> getMyReturns(String customerId, Pageable pageable) {
        return PagedResponse.of(
                returnRepository.findByCustomerId(customerId, pageable)
                        .map(this::toResponse));
    }

    public PagedResponse<ReturnResponse> getVendorReturns(String vendorId, Pageable pageable) {
        return PagedResponse.of(
                returnRepository.findByVendorId(vendorId, pageable)
                        .map(this::toResponse));
    }

    public PagedResponse<ReturnResponse> getVendorPendingReturns(String vendorId, Pageable pageable) {
        return PagedResponse.of(
                returnRepository.findByVendorIdAndStatus(vendorId, ReturnStatus.RETURN_REQUESTED, pageable)
                        .map(this::toResponse));
    }

    public PagedResponse<ReturnResponse> getAdminReturns(Pageable pageable) {
        return PagedResponse.of(
                returnRepository.findByStatusIn(List.of(
                        ReturnStatus.RETURN_REQUESTED,
                        ReturnStatus.UNDER_REVIEW,
                        ReturnStatus.APPEAL_REQUESTED,
                        ReturnStatus.PICKUP_SCHEDULED,
                        ReturnStatus.PICKED_UP,
                        ReturnStatus.RECEIVED_AT_WAREHOUSE,
                        ReturnStatus.QUALITY_CHECK,
                        ReturnStatus.REFUND_INITIATED
                ), pageable).map(this::toResponse));
    }

    /**
     * NOTE: REJECTED_POST_QUALITY_CHECK is intentionally excluded from
     * getAdminReturns' "active" set above (it's terminal, same as REJECTED),
     * and treated as a rejection in getAnalytics below.
     */

    public ReturnAnalytics getAnalytics() {
        long totalReturns = returnRepository.count();
        long approvedReturns = returnRepository.countByStatusIn(List.of(
                ReturnStatus.APPROVED,
                ReturnStatus.PICKUP_SCHEDULED,
                ReturnStatus.PICKED_UP,
                ReturnStatus.RECEIVED_AT_WAREHOUSE,
                ReturnStatus.QUALITY_CHECK,
                ReturnStatus.REFUND_INITIATED,
                ReturnStatus.REFUNDED
        ));
        long rejectedReturns = returnRepository.countByStatusIn(List.of(
                ReturnStatus.REJECTED,
                ReturnStatus.FINAL_REJECTED,
                ReturnStatus.REJECTED_POST_QUALITY_CHECK
        ));
        double totalRefundAmount = returnRepository.findAll().stream()
                .filter(r -> r.getStatus() == ReturnStatus.REFUNDED)
                .mapToDouble(ReturnRequest::getRefundAmount)
                .sum();
        double returnRate = totalReturns > 0 ? (double) approvedReturns / totalReturns * 100 : 0;

        return ReturnAnalytics.builder()
                .totalReturns(totalReturns)
                .approvedReturns(approvedReturns)
                .rejectedReturns(rejectedReturns)
                .refundAmount(totalRefundAmount)
                .returnRate(returnRate)
                .build();
    }

    /**
     * Clears the returnRequest flag on the exact matching order item so the
     * customer is allowed to raise a fresh return for it later (e.g. after a
     * rejection). Matches strictly by orderItemId, never by productId, since
     * the same product can appear as multiple distinct line items.
     */
    private void resetOrderItemReturnFlag(String orderId, String orderItemId) {
        Order order = orderRepository.findById(orderId).orElse(null);
        if (order == null) return;
        boolean itemFound = false;
        for (OrderItem item : order.getItems()) {
            if (orderItemId.equals(item.getId())) {
                item.setReturnRequest(false);
                itemFound = true;
                break;
            }
        }
        if (itemFound) orderRepository.save(order);
    }

    private ReturnRequest findById(String id) {
        return returnRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("ReturnRequest", id));
    }

    /** Max number of evidence photos a customer can attach to a single return request. */
    private static final int MAX_EVIDENCE_IMAGES = 5;

    private List<String> uploadEvidenceImages(List<MultipartFile> files, String orderId) {
        List<String> urls = new ArrayList<>();
        if (files == null || files.isEmpty()) return urls;

        if (files.size() > MAX_EVIDENCE_IMAGES)
            throw new IllegalStateException("You can attach up to " + MAX_EVIDENCE_IMAGES + " photos per return request");

        for (MultipartFile file : files) {
            if (file == null || file.isEmpty()) continue;
            String url = cloudinaryUploader.upload(file, "returns/" + orderId);
            if (url != null) urls.add(url);
        }
        return urls;
    }

    private ReturnResponse toResponse(ReturnRequest r) {
        ReturnResponse.ReturnResponseBuilder builder = ReturnResponse.builder()
                .id(r.getId())
                .orderId(r.getOrderId())
                .orderItemId(r.getOrderItemId())
                .customerId(r.getCustomerId())
                .vendorId(r.getVendorId())
                .productId(r.getProductId())
                .productName(r.getProductName())
                .reason(r.getReason())
                .description(r.getDescription())
                .evidenceImages(r.getEvidenceImages())
                .status(r.getStatus())
                .rejectionReason(r.getRejectionReason())
                .pickupDate(r.getPickupDate())
                .pickupAddress(r.getPickupAddress())
                .trackingNumber(r.getTrackingNumber())
                .refundMethod(r.getRefundMethod())
                .refundAmount(r.getRefundAmount())
                .razorpayRefundId(r.getRazorpayRefundId())
                .createdAt(r.getCreatedAt())
                .updatedAt(r.getUpdatedAt())
                .resolvedAt(r.getResolvedAt())
                .qualityCheckPassed(r.getQualityCheckPassed())
                .qualityCheckNotes(r.getQualityCheckNotes())
                .quantity(r.getQuantity());

        // Enrich with the order item's image/unit price, and the customer's
        // display name/email, for the vendor return-detail view. Best-effort:
        // a missing order or user shouldn't fail the whole response.
        orderRepository.findById(r.getOrderId()).ifPresent(order -> {
            order.getItems().stream()
                    .filter(item -> item.getId() != null && item.getId().equals(r.getOrderItemId()))
                    .findFirst()
                    .ifPresent(item -> {
                        builder.productImage(item.getImageUrl());
                        builder.unitPrice(item.getUnitPrice());
                    });
        });
        userRepository.findById(r.getCustomerId()).ifPresent(user -> {
            builder.customerName(user.getName());
            builder.customerEmail(user.getEmail());
        });

        return builder.build();
    }
}
