package com.marketplace.service;

import com.marketplace.config.PlanConfig;
import com.marketplace.dto.request.VendorRequest;
import com.marketplace.dto.response.*;
import com.marketplace.enums.PayoutStatus;
import com.marketplace.enums.SubscriptionStatus;
import com.marketplace.enums.VendorStatus;
import com.marketplace.exception.*;
import com.marketplace.model.*;
import com.marketplace.repository.*;
import com.marketplace.util.CloudinaryUploader;
import com.marketplace.util.RazorpayUtil;
import com.razorpay.RazorpayClient;
import com.razorpay.RazorpayException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.*;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class VendorService {

    private final VendorRepository                    vendorRepository;
    private final UserRepository                      userRepository;
    private final PayoutRequestRepository             payoutRequestRepository;
    private final VendorSubscriptionOrderRepository   subscriptionOrderRepository;
    private final CloudinaryUploader                  cloudinaryUploader;
    private final NotificationService                 notificationService;
    private final EmailService                        emailService;
    private final RazorpayClient                      razorpayClient;
    private final RazorpayUtil                        razorpayUtil;
    private final MongoTemplate                       mongoTemplate;

    @Value("${razorpay.key-id}") private String razorpayKeyId;

    // ── Store ─────────────────────────────────────────────────────────────────

    public VendorResponse getMyStore(String userId) {
        return toResponse(findByUserId(userId));
    }

    public VendorResponse updateStore(String userId, VendorRequest.UpdateStore req,
                                      MultipartFile logo) {
        Vendor vendor = findByUserId(userId);
        if (StringUtils.hasText(req.getStoreName()))
            vendor.setStoreName(req.getStoreName().trim());
        if (StringUtils.hasText(req.getStoreDescription()))
            vendor.setStoreDescription(req.getStoreDescription().trim());
        if (logo != null && !logo.isEmpty()) {
            vendor.setStoreLogo(cloudinaryUploader.upload(logo, "vendor-logos"));
        }
        return toResponse(vendorRepository.save(vendor));
    }

    public PagedResponse<VendorResponse> getPending(Pageable pageable) {
        return PagedResponse.of(
                vendorRepository.findByStatus(VendorStatus.PENDING, pageable)
                        .map(this::toResponse));
    }

    public VendorResponse approve(String vendorId) {
        Vendor vendor = findById(vendorId);
        vendor.setStatus(VendorStatus.APPROVED);

        if (vendor.getSubscriptionPlan() == null) {
            vendor.setSubscriptionPlan("FREE");
            vendor.setProductLimit(PlanConfig.FREE.getProductLimit());
            vendor.setCommissionRate(PlanConfig.FREE.getCommissionRate());
            vendor.setSubscriptionValidUntil(LocalDateTime.now().plusDays(PlanConfig.FREE.getValidityDays()));
            vendor.setSubscriptionStatus(SubscriptionStatus.ACTIVE);
        }

        vendorRepository.save(vendor);

        User user = userRepository.findById(vendor.getUserId()).orElse(null);
        if (user != null) {
            user.setActive(true);
            user.setEmailVerified(true);
            userRepository.save(user);
            notificationService.send(user.getId(), "Store Approved",
                    "Congratulations! Your store is now live.", "VENDOR_APPROVED", vendorId);
            emailService.sendVendorApproval(user.getEmail(), vendor.getStoreName());
        }

        return toResponse(vendor);
    }

    public VendorResponse reject(String vendorId, VendorRequest.Reject req) {
        Vendor vendor = findById(vendorId);
        vendor.setStatus(VendorStatus.REJECTED);
        vendor.setRejectionReason(req.getReason());
        vendorRepository.save(vendor);
        User user = userRepository.findById(vendor.getUserId()).orElse(null);
        if (user != null) {
            notificationService.send(user.getId(), "Store Application Rejected",
                    req.getReason(), "VENDOR_REJECTED", vendorId);
            emailService.sendVendorRejection(user.getEmail(), vendor.getStoreName(), req.getReason());
        }
        return toResponse(vendor);
    }

    public Vendor findByUserId(String userId) {
        return vendorRepository.findByUserId(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Vendor", userId));
    }

    public Vendor findById(String id) {
        return vendorRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Vendor", id));
    }

    public VendorResponse updateCommission(String vendorId, VendorRequest.UpdateCommission req) {
        Vendor vendor = findById(vendorId);
        vendor.setCommissionRate(req.getCommissionRate());
        return toResponse(vendorRepository.save(vendor));
    }

    public PayoutRequestResponse requestPayout(Vendor vendor) {
        if (vendor.getPendingPayout() <= 0)
            throw new IllegalStateException("No pending payout balance");

        // Block a new request while one is already awaiting admin review.
        if (payoutRequestRepository.existsByVendorIdAndStatus(vendor.getId(), PayoutStatus.PENDING))
            throw new IllegalStateException("A payout request is already pending review");

        // Atomically zero the vendor's pendingPayout so a concurrent/duplicate
        // call can't read the same balance and create a second request for it.
        Query zeroBalanceQuery = Query.query(
                Criteria.where("_id").is(vendor.getId())
                        .and("pendingPayout").gt(0));
        Update zeroBalanceUpdate = new Update().set("pendingPayout", 0.0);
        Vendor updatedVendor = mongoTemplate.findAndModify(
                zeroBalanceQuery,
                zeroBalanceUpdate,
                FindAndModifyOptions.options().returnNew(false),
                Vendor.class);
        if (updatedVendor == null)
            throw new IllegalStateException("No pending payout balance");

        PayoutRequest payoutRequest = payoutRequestRepository.save(
                PayoutRequest.builder()
                        .vendorId(vendor.getId())
                        .amount(updatedVendor.getPendingPayout())
                        .status(PayoutStatus.PENDING)
                        .requestedAt(LocalDateTime.now())
                        .build());

        notificationService.send(
                vendor.getUserId(),
                "Payout Requested",
                "Your payout request of ₹" + vendor.getPendingPayout()
                        + " has been submitted and is under review.",
                "PAYOUT_REQUEST",
                payoutRequest.getId()
        );

        return PayoutRequestResponse.builder()
                .id(payoutRequest.getId())
                .vendorId(vendor.getId())
                .vendorName(vendor.getStoreName())
                .amount(payoutRequest.getAmount())
                .status(payoutRequest.getStatus())
                .requestedAt(payoutRequest.getRequestedAt())
                .processedAt(payoutRequest.getProcessedAt())
                .processedBy(payoutRequest.getProcessedBy())
                .rejectionReason(payoutRequest.getRejectionReason())
                .build();
    }

    // ── Subscription — Plans ──────────────────────────────────────────────────

    /**
     * GET /api/vendor/payout/history
     * Returns paginated payout request history for the calling vendor, newest first.
     */
    public PagedResponse<PayoutRequestResponse> getMyPayoutHistory(String vendorId, Pageable pageable) {
        Page<PayoutRequest> page = payoutRequestRepository
                .findByVendorIdOrderByRequestedAtDesc(vendorId, pageable);
        return PagedResponse.of(page.map(p -> PayoutRequestResponse.builder()
                .id(p.getId())
                .vendorId(p.getVendorId())
                .amount(p.getAmount())
                .status(p.getStatus())
                .requestedAt(p.getRequestedAt())
                .processedAt(p.getProcessedAt())
                .processedBy(p.getProcessedBy())
                .rejectionReason(p.getRejectionReason())
                .build()));
    }

    /**
     * GET /api/vendor/subscription/plans
     * Single source of truth for plan metadata — prevents frontend/backend drift.
     */
    public List<Map<String, Object>> getPlans() {
        return Arrays.stream(PlanConfig.values())
                .map(p -> Map.<String, Object>of(
                        "plan",           p.name(),
                        "price",          p.getPrice(),
                        "productLimit",   p.getProductLimit(),
                        "commissionRate", p.getCommissionRate(),
                        "validityDays",   p.getValidityDays()))
                .toList();
    }

    /** GET /api/vendor/subscription/current */
    public VendorResponse getCurrentSubscription(String userId) {
        return toResponse(findByUserId(userId));
    }

    /** GET /api/vendor/subscription/history */
    public PagedResponse<VendorSubscriptionOrderResponse> getSubscriptionHistory(
            String userId, Pageable pageable) {
        Vendor vendor = findByUserId(userId);
        return PagedResponse.of(
                subscriptionOrderRepository
                        .findByVendorIdOrderByCreatedAtDesc(vendor.getId(), pageable)
                        .map(this::toOrderResponse));
    }

    // ── Subscription — Payment ────────────────────────────────────────────────

    /**
     * POST /api/vendor/subscription/initiate
     *
     * FIX §1.4: Persists a PENDING VendorSubscriptionOrder BEFORE returning the
     * Razorpay order to the client. This is the record /verify checks against,
     * which closes the plan/amount-tampering hole (§1.1) and enables the webhook
     * fallback (§1.3).
     */
    public Map<String, Object> initiateSubscriptionPayment(String userId, String plan) {
        PlanConfig planConfig = PlanConfig.fromName(plan);
        Vendor vendor = findByUserId(userId);

        if (vendor.getStatus() != VendorStatus.APPROVED)
            throw new BadRequestException("Your vendor account must be approved before subscribing to a plan.");

        if (planConfig.isFree()) {
            // Record for audit history even for free downgrades; activate immediately.
            applyPlanToVendor(vendor, PlanConfig.FREE);
            return Map.of("plan", "FREE");
        }

        long amountPaise = planConfig.getPrice() * 100L;

        // Persist PENDING order first — creates the authoritative record before any
        // Razorpay call, so there's never an "order exists in Razorpay but not in our DB" state.
        VendorSubscriptionOrder order = subscriptionOrderRepository.save(
                VendorSubscriptionOrder.builder()
                        .vendorId(vendor.getId())
                        .userId(userId)
                        .plan(plan.toUpperCase())
                        .amount(amountPaise)
                        .status(SubscriptionStatus.PENDING)
                        .validityDays(planConfig.getValidityDays())
                        .build());

        try {
            JSONObject opts = new JSONObject();
            opts.put("amount",   amountPaise);
            opts.put("currency", "INR");
            opts.put("receipt",  order.getId());   // receipt == our internal order id

            com.razorpay.Order rzpOrder = razorpayClient.orders.create(opts);
            String razorpayOrderId = rzpOrder.get("id");

            order.setRazorpayOrderId(razorpayOrderId);
            subscriptionOrderRepository.save(order);

            log.info("Created Razorpay subscription order {} (internal {}) for vendor {} plan {}",
                    razorpayOrderId, order.getId(), vendor.getId(), plan);

            return Map.of(
                    "razorpayOrderId", razorpayOrderId,
                    "amount",          amountPaise,
                    "currency",        "INR",
                    "keyId",           razorpayKeyId.trim());

        } catch (RazorpayException e) {
            subscriptionOrderRepository.delete(order);   // don't leave an orphaned PENDING record
            log.error("Failed to create Razorpay subscription order: {}", e.getMessage());
            throw new PaymentException("Failed to initiate subscription payment: " + e.getMessage(), e);
        }
    }

    /**
     * POST /api/vendor/subscription/verify
     *
     * FIX §1.1: plan + amount are read from the persisted PENDING order, never from
     *           the request body — closes the plan/price-tampering hole.
     * FIX §1.2: PENDING → ACTIVE transition is atomic via findAndModify, so a replayed
     *           call is a no-op — closes the payment-replay hole.
     */
    public VendorResponse activateSubscription(String userId,
                                               String plan,
                                               String razorpayOrderId,
                                               String razorpayPaymentId,
                                               String signature) {
        Vendor vendor = findByUserId(userId);

        if ("FREE".equalsIgnoreCase(plan)) {
            applyPlanToVendor(vendor, PlanConfig.FREE);
            return toResponse(vendor);
        }

        if (razorpayOrderId == null || razorpayPaymentId == null || signature == null)
            throw new BadRequestException("Payment verification details are required for paid plans.");

        VendorSubscriptionOrder order = subscriptionOrderRepository
                .findByRazorpayOrderId(razorpayOrderId)
                .orElseThrow(() -> new ResourceNotFoundException("Subscription order", razorpayOrderId));

        if (!order.getVendorId().equals(vendor.getId()))
            throw new UnauthorizedException("Not your subscription order");

        // Idempotent: already ACTIVE means a previous call (or webhook) already succeeded.
        if (order.getStatus() == SubscriptionStatus.ACTIVE)
            return toResponse(vendorRepository.findByUserId(userId)
                    .orElseThrow(() -> new ResourceNotFoundException("Vendor", userId)));

        if (order.getStatus() != SubscriptionStatus.PENDING)
            throw new IllegalStateException(
                    "Subscription order is in status " + order.getStatus() + " and cannot be confirmed");

        if (!razorpayUtil.verifyPaymentSignature(razorpayOrderId, razorpayPaymentId, signature))
            throw new PaymentException("Invalid payment signature. Subscription not activated.", null);

        // Atomic claim — only the first caller wins; replays return false and are no-ops.
        PlanConfig planConfig = PlanConfig.fromName(order.getPlan());
        if (claimSubscriptionOrder(order.getId(), razorpayPaymentId)) {
            vendor = findByUserId(userId);  // re-fetch in case another path modified it
            applyPlanToVendor(vendor, planConfig);
        }

        return toResponse(findByUserId(userId));
    }

    /**
     * Called by the webhook fallback (§1.3) when Razorpay fires payment.captured
     * for a subscription order that the client never confirmed (closed tab, etc.).
     */
    public void confirmSubscriptionFromWebhook(String razorpayOrderId, String razorpayPaymentId) {
        subscriptionOrderRepository.findByRazorpayOrderId(razorpayOrderId).ifPresent(order -> {
            if (order.getStatus() != SubscriptionStatus.PENDING) {
                log.info("Webhook: subscription order {} already in status {}, skipping",
                        order.getId(), order.getStatus());
                return;
            }
            PlanConfig planConfig = PlanConfig.fromName(order.getPlan());
            if (claimSubscriptionOrder(order.getId(), razorpayPaymentId)) {
                Vendor vendor = vendorRepository.findById(order.getVendorId()).orElse(null);
                if (vendor != null) {
                    applyPlanToVendor(vendor, planConfig);
                    log.info("Webhook: activated {} plan for vendor {} via subscription order {}",
                            planConfig.name(), vendor.getId(), order.getId());
                }
            }
        });
    }

    // ── Subscription helpers ──────────────────────────────────────────────────

    /**
     * Atomic PENDING → ACTIVE claim. Returns true only for the single winner of a
     * potential race (concurrent verify calls, webhook vs. client, etc.).
     * Mirrors WalletService.claimTopup().
     */
    private boolean claimSubscriptionOrder(String orderId, String paymentId) {
        Query q = Query.query(
                Criteria.where("_id").is(orderId)
                        .and("status").is(SubscriptionStatus.PENDING));
        Update u = new Update()
                .set("status",      SubscriptionStatus.ACTIVE)
                .set("paymentId",   paymentId)
                .set("completedAt", LocalDateTime.now());
        VendorSubscriptionOrder claimed = mongoTemplate.findAndModify(
                q, u, FindAndModifyOptions.options().returnNew(true),
                VendorSubscriptionOrder.class);
        return claimed != null;
    }

    /**
     * Writes subscription fields to the Vendor document and saves.
     * Single path used by initiate (FREE), verify, webhook fallback, and the
     * expiry scheduler — no duplication of "how to activate a plan".
     */
    private void applyPlanToVendor(Vendor vendor, PlanConfig planConfig) {
        vendor.setSubscriptionPlan(planConfig.name());
        vendor.setProductLimit(planConfig.getProductLimit());
        vendor.setCommissionRate(planConfig.getCommissionRate());
        vendor.setSubscriptionValidUntil(LocalDateTime.now().plusDays(planConfig.getValidityDays()));
        vendor.setSubscriptionStatus(SubscriptionStatus.ACTIVE);
        vendorRepository.save(vendor);

        log.info("Activated {} plan for vendor {}", planConfig.name(), vendor.getId());
        notificationService.send(vendor.getUserId(), "Subscription Activated",
                "Your " + planConfig.name() + " plan is now active!",
                "SUBSCRIPTION_ACTIVATED", vendor.getId());
    }

    private VendorSubscriptionOrderResponse toOrderResponse(VendorSubscriptionOrder o) {
        return VendorSubscriptionOrderResponse.builder()
                .id(o.getId())
                .plan(o.getPlan())
                .amount(o.getAmount())
                .status(o.getStatus())
                .createdAt(o.getCreatedAt())
                .completedAt(o.getCompletedAt())
                .build();
    }

    // ── DTO mapping ───────────────────────────────────────────────────────────

    public VendorResponse toResponse(Vendor v) {
        return VendorResponse.builder()
                .id(v.getId())
                .userId(v.getUserId())
                .storeName(v.getStoreName())
                .storeDescription(v.getStoreDescription())
                .storeLogo(v.getStoreLogo())
                .commissionRate(v.getCommissionRate())
                .status(v.getStatus())
                .rejectionReason(v.getRejectionReason())
                .totalEarnings(v.getTotalEarnings())
                .pendingPayout(v.getPendingPayout())
                .createdAt(v.getCreatedAt())
                .subscriptionPlan(v.getSubscriptionPlan())
                .subscriptionValidUntil(v.getSubscriptionValidUntil())
                .productLimit(v.getProductLimit())
                .subscriptionStatus(v.getSubscriptionStatus())
                .build();
    }
}