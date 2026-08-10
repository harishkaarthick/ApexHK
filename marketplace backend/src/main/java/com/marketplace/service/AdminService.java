package com.marketplace.service;

import com.marketplace.dto.request.*;
import com.marketplace.enums.SubscriptionStatus;
import com.marketplace.dto.response.*;
import com.marketplace.enums.OrderStatus;
import com.marketplace.enums.BannerPlacement;
import com.marketplace.enums.PayoutStatus;
import com.marketplace.enums.ReturnStatus;
import com.marketplace.enums.Role;
import com.marketplace.enums.VendorStatus;
import com.marketplace.exception.BadRequestException;
import com.marketplace.exception.ResourceNotFoundException;
import com.marketplace.model.*;
import com.marketplace.repository.*;
import com.marketplace.util.CloudinaryUploader;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.data.domain.*;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AdminService {

    private final UserRepository    userRepository;
    private final ProductRepository productRepository;
    private final CouponRepository  couponRepository;
    private final BannerRepository  bannerRepository;
    private final OrderRepository   orderRepository;
    private final VendorRepository  vendorRepository;
    private final PayoutRequestRepository payoutRequestRepository;
    private final ReturnRepository  returnRepository;
    private final VendorService                   vendorService;
    private final VendorSubscriptionOrderRepository subscriptionOrderRepository;
    private final ProductService    productService;
    private final CloudinaryUploader cloudinaryUploader;
    private final MongoTemplate     mongoTemplate;
    // Fix E: needed to send appeal-outcome notifications to the customer,
    // matching the behaviour already present in ReturnService.adminResolveAppeal().
    private final NotificationService notificationService;

    // ── Users ─────────────────────────────────────────────────────────────────

    public PagedResponse<UserResponse> getAllUsers(Pageable pageable) {
        return PagedResponse.of(
                userRepository.findAll(pageable).map(this::toUserResponse));
    }

    public void toggleUser(String userId, String callerUserId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId));
        if (userId.equals(callerUserId) && user.isActive())
            throw new IllegalStateException("Admins cannot deactivate their own account");
        if (user.getRole() == Role.ADMIN && user.isActive()) {
            long adminCount = userRepository.countByRoleAndIsActiveTrue(Role.ADMIN);
            if (adminCount <= 1)
                throw new IllegalStateException(
                        "Cannot deactivate the last active admin account");
        }
        user.setActive(!user.isActive());
        userRepository.save(user);
    }

    // ── Orders ────────────────────────────────────────────────────────────────

    public PagedResponse<AdminOrderResponse> getAllOrders(Pageable pageable,
                                                          OrderStatus status,
                                                          LocalDateTime from,
                                                          LocalDateTime to,
                                                          String customerId) {
        Query query = new Query();
        List<Criteria> criteria = new ArrayList<>();
        if (status != null) criteria.add(Criteria.where("status").is(status));
        if (customerId != null && !customerId.isBlank())
            criteria.add(Criteria.where("customerId").is(customerId));
        if (from != null || to != null) {
            Criteria placedAt = Criteria.where("placedAt");
            if (from != null) placedAt = placedAt.gte(from);
            if (to != null) placedAt = placedAt.lte(to);
            criteria.add(placedAt);
        }
        if (!criteria.isEmpty())
            query.addCriteria(new Criteria().andOperator(criteria.toArray(new Criteria[0])));

        long total = mongoTemplate.count(query, Order.class);
        query.with(pageable);
        Page<Order> page = new PageImpl<>(
                mongoTemplate.find(query, Order.class),
                pageable,
                total);
        return PagedResponse.of(page.map(this::toAdminOrderResponse));
    }

    // ── Coupons ───────────────────────────────────────────────────────────────

    public CouponResponse createCoupon(CouponRequest.Create req) {
        if (couponRepository.existsByCodeIgnoreCase(req.getCode()))
            throw new IllegalStateException("Coupon code already exists");
        return toCouponResponse(couponRepository.save(Coupon.builder()
                .code(req.getCode().toUpperCase())
                .description(req.getDescription())
                .discountType(req.getDiscountType())
                .discountValue(req.getDiscountValue())
                .maxDiscount(req.getMaxDiscount())
                .minimumOrderValue(req.getMinimumOrderValue())
                .expiresAt(req.getExpiresAt())
                .usageLimit(req.getUsageLimit())
                .applicableCategories(req.getApplicableCategories() == null
                        ? new java.util.HashSet<>() : new java.util.HashSet<>(req.getApplicableCategories()))
                .firstOrderOnly(req.isFirstOrderOnly())
                .userSegment(req.getUserSegment() == null ? Coupon.UserSegment.ALL : req.getUserSegment())
                .build()));
    }

    public void toggleCoupon(String couponId) {
        Coupon c = couponRepository.findById(couponId)
                .orElseThrow(() -> new ResourceNotFoundException("Coupon", couponId));
        c.setActive(!c.isActive());
        couponRepository.save(c);
    }

    public void deleteCoupon(String couponId) {
        if (!couponRepository.existsById(couponId))
            throw new ResourceNotFoundException("Coupon", couponId);
        couponRepository.deleteById(couponId);
    }

    public PagedResponse<CouponResponse> getCoupons(Pageable pageable) {
        return PagedResponse.of(
                couponRepository.findAll(pageable).map(this::toCouponResponse));
    }

    // ── Banners ───────────────────────────────────────────────────────────────

    @CacheEvict(value = "banners", allEntries = true)
    public BannerResponse createBanner(BannerRequest.Create req, MultipartFile image) {
        if (image == null || image.isEmpty()) {
            throw new BadRequestException("Banner image is required");
        }
        String contentType = image.getContentType();
        if (contentType == null || !contentType.startsWith("image/")) {
            throw new BadRequestException("Banner image must be an image file");
        }

        String url = cloudinaryUploader.upload(image, "banners");
        return toBannerResponse(bannerRepository.save(Banner.builder()
                .title(req.getTitle())
                .imageUrl(url)
                .linkUrl(req.getLinkUrl())
                .description(req.getDescription())
                .isActive(req.isActive())
                .displayOrder(req.getDisplayOrder())
                .expiresAt(req.getExpiresAt())
                .placement(req.getPlacement() != null ? req.getPlacement() : BannerPlacement.HOME)
                .build()));
    }

    @CacheEvict(value = "banners", allEntries = true)
    public void deleteBanner(String bannerId) {
        if (!bannerRepository.existsById(bannerId))
            throw new ResourceNotFoundException("Banner", bannerId);
        bannerRepository.deleteById(bannerId);
    }

    public PagedResponse<BannerResponse> getBanners(Pageable pageable) {
        return PagedResponse.of(
                bannerRepository.findAll(pageable).map(this::toBannerResponse));
    }

    @CacheEvict(value = "banners", allEntries = true)
    public void toggleBanner(String bannerId) {
        Banner b = bannerRepository.findById(bannerId)
                .orElseThrow(() -> new ResourceNotFoundException("Banner", bannerId));
        b.setActive(!b.isActive());
        bannerRepository.save(b);
    }

    // ── Vendor management (delegates to VendorService) ────────────────────────

    public PagedResponse<VendorResponse> getPendingVendors(Pageable pageable) {
        return vendorService.getPending(pageable);
    }

    public PagedResponse<VendorResponse> getAllVendors(Pageable pageable, VendorStatus status) {
        Page<Vendor> page = status != null
                ? vendorRepository.findByStatus(status, pageable)
                : vendorRepository.findAll(pageable);
        return PagedResponse.of(page.map(vendorService::toResponse));
    }

    public VendorResponse approveVendor(String vendorId) {
        return vendorService.approve(vendorId);
    }

    public VendorResponse rejectVendor(String vendorId, VendorRequest.Reject req) {
        return vendorService.reject(vendorId, req);
    }

    public VendorResponse updateVendorCommission(String vendorId, VendorRequest.UpdateCommission req) {
        return vendorService.updateCommission(vendorId, req);
    }

    // Issue 3 fix: batch-load all vendors for the current page in a single
    // findAllById() call, then pass the Map into toPayoutResponse() to eliminate
    // the N+1 vendorRepository.findById() that previously ran once per row.
    public PagedResponse<PayoutRequestResponse> getAllPayouts(Pageable pageable) {
        Page<PayoutRequest> page = payoutRequestRepository.findAll(pageable);
        Map<String, Vendor> vendorMap = buildVendorMap(page.getContent());
        return PagedResponse.of(page.map(p -> toPayoutResponse(p, vendorMap)));
    }

    public PagedResponse<PayoutRequestResponse> getPendingPayouts(Pageable pageable) {
        Page<PayoutRequest> page = payoutRequestRepository.findByStatus(PayoutStatus.PENDING, pageable);
        Map<String, Vendor> vendorMap = buildVendorMap(page.getContent());
        return PagedResponse.of(page.map(p -> toPayoutResponse(p, vendorMap)));
    }

    /** Fetches all distinct vendors for a list of payout rows in one query. */
    private Map<String, Vendor> buildVendorMap(List<PayoutRequest> payouts) {
        List<String> vendorIds = payouts.stream()
                .map(PayoutRequest::getVendorId)
                .distinct()
                .collect(Collectors.toList());
        return vendorRepository.findAllById(vendorIds).stream()
                .collect(Collectors.toMap(Vendor::getId, v -> v));
    }

    public PayoutRequestResponse approvePayout(String payoutId, String adminUserId) {
        PayoutRequest payout = payoutRequestRepository.findById(payoutId)
                .orElseThrow(() -> new ResourceNotFoundException("PayoutRequest", payoutId));
        if (payout.getStatus() != PayoutStatus.PENDING)
            throw new IllegalStateException("Payout is already in status " + payout.getStatus());

        // pendingPayout was already zeroed when vendor submitted the request,
        // so no deduction is needed here. We only need to mark the status and
        // set the 7-day cooldown window on the vendor.
        Query payoutQuery = Query.query(
                Criteria.where("_id").is(payoutId)
                        .and("status").is(PayoutStatus.PENDING));
        Update payoutUpdate = new Update()
                .set("status", PayoutStatus.PAID)
                .set("processedAt", LocalDateTime.now())
                .set("processedBy", adminUserId);
        PayoutRequest processed = mongoTemplate.findAndModify(
                payoutQuery,
                payoutUpdate,
                FindAndModifyOptions.options().returnNew(true),
                PayoutRequest.class);
        if (processed == null)
            throw new IllegalStateException("Payout request was already processed");

        // Set 7-day cooldown on vendor so they cannot re-request immediately
        mongoTemplate.updateFirst(
                Query.query(Criteria.where("_id").is(payout.getVendorId())),
                new Update().set("nextPayoutDate", LocalDateTime.now().plusDays(7)),
                Vendor.class);

        return toPayoutResponse(processed);
    }

    public PayoutRequestResponse rejectPayout(String payoutId, VendorRequest.Reject req, String adminUserId) {
        Query query = Query.query(
                Criteria.where("_id").is(payoutId)
                        .and("status").is(PayoutStatus.PENDING));
        Update update = new Update()
                .set("status", PayoutStatus.REJECTED)
                .set("processedAt", LocalDateTime.now())
                .set("processedBy", adminUserId)
                .set("rejectionReason", req.getReason());
        PayoutRequest processed = mongoTemplate.findAndModify(
                query,
                update,
                FindAndModifyOptions.options().returnNew(true),
                PayoutRequest.class);
        if (processed == null)
            throw new IllegalStateException("Payout request is not pending");

        // Restore the payout amount back to vendor's pendingPayout balance
        // (it was zeroed when the vendor submitted the request)
        mongoTemplate.updateFirst(
                Query.query(Criteria.where("_id").is(processed.getVendorId())),
                new Update().inc("pendingPayout", processed.getAmount()),
                Vendor.class);

        return toPayoutResponse(processed);
    }

    public PagedResponse<ReturnResponse> getAllReturns(Pageable pageable, ReturnStatus status) {
        Page<ReturnRequest> page = status != null
                ? returnRepository.findByStatus(status, pageable)
                : returnRepository.findAll(pageable);
        return PagedResponse.of(page.map(this::toReturnResponse));
    }

    public PagedResponse<ProductResponse> getAllProducts(Pageable pageable, String vendorId) {
    Page<Product> page = vendorId != null && !vendorId.isBlank()
            ? productRepository.findByVendorIdAndIsActiveTrue(vendorId, pageable)  // ✅ already exists in repo
            : productRepository.findByIsActiveTrue(pageable);                       // ✅ already exists in repo
    return PagedResponse.of(page.map(productService::toResponse));
}

    @CacheEvict(value = {"products", "product"}, allEntries = true)
    public void removeProduct(String productId) {
        Product p = productRepository.findById(productId)
                .orElseThrow(() -> new ResourceNotFoundException("Product", productId));
        p.setActive(false);
        productRepository.save(p);
    }

    public DashboardStats getDashboardStats() {
        Double totalRevenue = orderRepository.sumTotalRevenue();
        Double totalPayoutAmount = payoutRequestRepository.sumApprovedOrPaidAmount();
        return DashboardStats.builder()
                .totalUsers(userRepository.count())
                .totalVendors(vendorRepository.count())
                .pendingVendors(vendorRepository.countByStatus(VendorStatus.PENDING))
                .pendingPayouts(payoutRequestRepository.countByStatus(PayoutStatus.PENDING))
                // Issue 2 fix: only count PAID (APPROVED is never written by approvePayout).
                // Field renamed to paidPayouts to match DashboardStats.java.
                .paidPayouts(payoutRequestRepository.countByStatus(PayoutStatus.PAID))
                .totalPayoutAmount(totalPayoutAmount != null ? totalPayoutAmount : 0.0)
                .totalOrders(orderRepository.count())
                .totalRevenue(totalRevenue != null ? totalRevenue : 0.0)
                .totalProducts(productRepository.count())
                .build();
    }

    public ReturnAnalytics getReturnsAnalytics() {
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
        // Issue 1 fix: replaced findAll().stream() full table scan with a
        // MongoDB $group aggregation that only touches REFUNDED documents.
        Double rawRefundAmount = returnRepository.sumRefundedAmount();
        double totalRefundAmount = rawRefundAmount != null ? rawRefundAmount : 0.0;
        double returnRate = totalReturns > 0 ? (double) approvedReturns / totalReturns * 100 : 0;

        return ReturnAnalytics.builder()
                .totalReturns(totalReturns)
                .approvedReturns(approvedReturns)
                .rejectedReturns(rejectedReturns)
                .refundAmount(totalRefundAmount)
                .returnRate(returnRate)
                .build();
    }
    
    // Add this method inside AdminService class
        @CacheEvict(value = {"products", "product"}, allEntries = true)
        public void toggleProductVisibility(String productId) {
            Product p = productRepository.findById(productId)
            .orElseThrow(() -> new ResourceNotFoundException("Product", productId));
            p.setActive(!p.isActive());
        productRepository.save(p);
        }

    public ReturnResponse resolveReturn(String returnId, ReturnRequestDto.UpdateStatus req) {
        ReturnRequest existing = returnRepository.findById(returnId)
                .orElseThrow(() -> new ResourceNotFoundException("ReturnRequest", returnId));

        // Issue 4 fix: ADMIN_REVIEW is now included as an allowed status.
        // Returns that have been escalated to ADMIN_REVIEW can now be resolved
        // by an admin instead of throwing IllegalStateException.
        if (existing.getStatus() == ReturnStatus.RETURN_REQUESTED ||
                existing.getStatus() == ReturnStatus.UNDER_REVIEW ||
                existing.getStatus() == ReturnStatus.ADMIN_REVIEW) {
            existing.setStatus(req.getStatus());
            existing.setUpdatedAt(LocalDateTime.now());
            returnRepository.save(existing);
            return toReturnResponse(existing);
        } else {
            throw new IllegalStateException(
                    "Return is already in status " + existing.getStatus()
                            + " and cannot be resolved by admin");
        }
    }

    public ReturnResponse resolveAppeal(String returnId, ReturnRequestDto.UpdateStatus req,
                                       String resolutionReason) {
        ReturnRequest existing = returnRepository.findById(returnId)
                .orElseThrow(() -> new ResourceNotFoundException("ReturnRequest", returnId));

        if (existing.getStatus() != ReturnStatus.APPEAL_REQUESTED)
            throw new IllegalStateException(
                    "Return is already in status " + existing.getStatus()
                            + " and cannot be resolved");

        if (req.getStatus() != ReturnStatus.FINAL_APPROVED && req.getStatus() != ReturnStatus.FINAL_REJECTED)
            throw new IllegalStateException("Invalid final status for appeal resolution");

        existing.setStatus(req.getStatus());
        // Fix E: was setRejectionReason() — semantically wrong when the outcome is
        // FINAL_APPROVED, and overwrote the vendor's original rejection reason.
        // The model has a dedicated adminResolutionReason field for exactly this purpose,
        // consistent with how ReturnService.adminResolveAppeal() stores it.
        existing.setAdminResolutionReason(resolutionReason);
        existing.setResolvedAt(LocalDateTime.now());
        existing.setUpdatedAt(LocalDateTime.now());
        returnRepository.save(existing);

        // Fix E: notify the customer of the appeal outcome, matching the notification
        // behaviour in ReturnService.adminResolveAppeal() that was missing here.
        if (req.getStatus() == ReturnStatus.FINAL_APPROVED) {
            notificationService.send(existing.getCustomerId(), "Appeal Approved",
                    "Your appeal has been approved. The return will be processed again.",
                    "APPEAL_APPROVED", existing.getId());
        } else {
            notificationService.send(existing.getCustomerId(), "Appeal Rejected",
                    "Your appeal has been rejected. " + resolutionReason,
                    "APPEAL_REJECTED", existing.getId());
        }

        return toReturnResponse(existing);
    }

    // ── Subscription management ──────────────────────────────────────────────

    /**
     * GET /api/admin/subscriptions
     * Lists all subscription orders across all vendors, optionally filtered by plan.
     */
    public PagedResponse<VendorSubscriptionOrderResponse> getAllSubscriptions(
            String plan, Pageable pageable) {
        Page<VendorSubscriptionOrder> page;
        if (plan != null && !plan.isBlank()) {
            Query q = new Query(Criteria.where("plan").is(plan.toUpperCase())).with(pageable);
            long total = mongoTemplate.count(Query.of(q).limit(-1).skip(-1), VendorSubscriptionOrder.class);
            page = new PageImpl<>(mongoTemplate.find(q, VendorSubscriptionOrder.class), pageable, total);
        } else {
            page = subscriptionOrderRepository.findAll(pageable);
        }
        return PagedResponse.of(page.map(this::toSubscriptionOrderResponse));
    }

    /**
     * POST /api/admin/subscriptions/{vendorId}/cancel
     * Atomically cancels a vendor's active subscription and downgrades them to FREE.
     */
    public VendorResponse cancelVendorSubscription(String vendorId) {
        Vendor vendor = vendorRepository.findById(vendorId)
                .orElseThrow(() -> new ResourceNotFoundException("Vendor", vendorId));

        if ("FREE".equalsIgnoreCase(vendor.getSubscriptionPlan()))
            throw new IllegalStateException("Vendor is already on the FREE plan");

        vendor.setSubscriptionPlan(com.marketplace.config.PlanConfig.FREE.name());
        vendor.setProductLimit(com.marketplace.config.PlanConfig.FREE.getProductLimit());
        vendor.setCommissionRate(com.marketplace.config.PlanConfig.FREE.getCommissionRate());
        vendor.setSubscriptionValidUntil(java.time.LocalDateTime.now()
                .plusDays(com.marketplace.config.PlanConfig.FREE.getValidityDays()));
        vendor.setSubscriptionStatus(SubscriptionStatus.CANCELLED);
        vendorRepository.save(vendor);

        return vendorService.toResponse(vendor);
    }

    private VendorSubscriptionOrderResponse toSubscriptionOrderResponse(VendorSubscriptionOrder o) {
        return VendorSubscriptionOrderResponse.builder()
                .id(o.getId())
                .plan(o.getPlan())
                .amount(o.getAmount())
                .status(o.getStatus())
                .createdAt(o.getCreatedAt())
                .completedAt(o.getCompletedAt())
                .build();
    }

    // ── Mappers ───────────────────────────────────────────────────────────────

    private CouponResponse toCouponResponse(Coupon c) {
        return CouponResponse.builder()
                .id(c.getId())
                .code(c.getCode())
                .description(c.getDescription())
                .discountType(c.getDiscountType())
                .discountValue(c.getDiscountValue())
                .maxDiscount(c.getMaxDiscount())
                .minimumOrderValue(c.getMinimumOrderValue())
                .expiresAt(c.getExpiresAt())
                .isActive(c.isActive())
                .usageLimit(c.getUsageLimit())
                .usageCount(c.getUsageCount())
                .applicableCategories(c.getApplicableCategories())
                .firstOrderOnly(c.isFirstOrderOnly())
                .userSegment(c.getUserSegment())
                .build();
    }

    private BannerResponse toBannerResponse(Banner b) {
        return BannerResponse.builder()
                .id(b.getId())
                .title(b.getTitle())
                .imageUrl(b.getImageUrl())
                .linkUrl(b.getLinkUrl())
                .description(b.getDescription())
                .isActive(b.isActive())
                .displayOrder(b.getDisplayOrder())
                .createdAt(b.getCreatedAt())
                .expiresAt(b.getExpiresAt())
                .placement(b.getPlacement())
                .build();
    }

    private UserResponse toUserResponse(User u) {
        return UserResponse.builder()
                .id(u.getId())
                .name(u.getName())
                .email(u.getEmail())
                .role(u.getRole())
                .referralCode(u.getReferralCode())
                .addresses(u.getAddresses())
                .isActive(u.isActive())
                .createdAt(u.getCreatedAt())
                .updatedAt(u.getUpdatedAt())
                .build();
    }

    private AdminOrderResponse toAdminOrderResponse(Order o) {
        return AdminOrderResponse.builder()
                .id(o.getId())
                .customerId(o.getCustomerId())
                .customerName(o.getCustomerName())
                .items(o.getItems())
                .vendorOrders(o.getVendorOrders())
                .shippingAddress(o.getShippingAddress())
                .total(o.getTotalAmount())
                .totalAmount(o.getTotalAmount())
                .discountAmount(o.getDiscountAmount())
                .walletAmountUsed(o.getWalletAmountUsed())
                .razorpayAmount(o.getRazorpayAmount())
                .couponCode(o.getCouponCode())
                .razorpayOrderId(o.getRazorpayOrderId())
                .paymentId(o.getPaymentId())
                .status(o.getStatus())
                .trackingId(o.getTrackingId())
                .placedAt(o.getPlacedAt())
                .deliveredAt(o.getDeliveredAt())
                .build();
    }

    // Issue 3 fix: two-signature mapper.
    // Batch callers (getAllPayouts, getPendingPayouts) supply a pre-built Map to avoid N+1.
    // Single-record callers (approvePayout, rejectPayout) fall through to the
    // one-arg overload which does a single lookup — acceptable for a single row.
    private PayoutRequestResponse toPayoutResponse(PayoutRequest payout, Map<String, Vendor> vendorMap) {
        Vendor vendor = vendorMap.get(payout.getVendorId());
        return PayoutRequestResponse.builder()
                .id(payout.getId())
                .vendorId(payout.getVendorId())
                .vendorName(vendor != null ? vendor.getStoreName() : "Unknown vendor")
                .amount(payout.getAmount())
                .status(payout.getStatus())
                .requestedAt(payout.getRequestedAt())
                .processedAt(payout.getProcessedAt())
                .processedBy(payout.getProcessedBy())
                .rejectionReason(payout.getRejectionReason())
                .build();
    }

    private PayoutRequestResponse toPayoutResponse(PayoutRequest payout) {
        Vendor vendor = vendorRepository.findById(payout.getVendorId()).orElse(null);
        return PayoutRequestResponse.builder()
                .id(payout.getId())
                .vendorId(payout.getVendorId())
                .vendorName(vendor != null ? vendor.getStoreName() : "Unknown vendor")
                .amount(payout.getAmount())
                .status(payout.getStatus())
                .requestedAt(payout.getRequestedAt())
                .processedAt(payout.getProcessedAt())
                .processedBy(payout.getProcessedBy())
                .rejectionReason(payout.getRejectionReason())
                .build();
    }

    private ReturnResponse toReturnResponse(ReturnRequest r) {
        return ReturnResponse.builder()
                .id(r.getId())
                .orderId(r.getOrderId())
                // Fix F: orderItemId was not mapped — admin couldn't trace which
                // specific item in a multi-item order the return belongs to.
                .orderItemId(r.getOrderItemId())
                .customerId(r.getCustomerId())
                .vendorId(r.getVendorId())
                .productId(r.getProductId())
                .productName(r.getProductName())
                .reason(r.getReason())
                .description(r.getDescription())
                // Fix F: evidence images dropped — admin couldn't see customer-uploaded photos.
                .evidenceImages(r.getEvidenceImages())
                .status(r.getStatus())
                .rejectionReason(r.getRejectionReason())
                // Fix F: pickup details dropped — admin couldn't see scheduled pickup info.
                .pickupDate(r.getPickupDate())
                .pickupAddress(r.getPickupAddress())
                // Fix F: trackingNumber dropped — admin couldn't see courier tracking info.
                .trackingNumber(r.getTrackingNumber())
                // Fix F: refundMethod dropped — admin couldn't see how the refund was issued.
                .refundMethod(r.getRefundMethod())
                .refundAmount(r.getRefundAmount())
                .razorpayRefundId(r.getRazorpayRefundId())
                .createdAt(r.getCreatedAt())
                .updatedAt(r.getUpdatedAt())
                .resolvedAt(r.getResolvedAt())
                .build();
    }

}