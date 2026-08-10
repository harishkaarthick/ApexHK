package com.marketplace.controller;

import com.marketplace.enums.OrderStatus;
import com.marketplace.model.Order;
import com.marketplace.repository.OrderRepository;
import com.marketplace.service.OrderService;
import com.marketplace.service.VendorService;
import com.marketplace.service.WalletService;
import com.marketplace.util.RazorpayUtil;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Handles inbound Razorpay payment webhooks and scheduled stale-order cleanup.
 *
 * ADD-03 FIX: renamed from Paymentwebhookcontroller (non-standard casing) to
 * PaymentWebhookController to comply with Java naming conventions and make
 * the class discoverable via standard tooling searches.
 *
 * ADD-02 FIX: cancelStalePendingOrders() no longer duplicates stock-restore /
 * wallet-refund / coupon-rollback logic inline.  After the atomic PENDING→CANCELLED
 * claim it delegates all side-effects to OrderService.cancelStaleOrder(), so there
 * is a single authoritative rollback path in the service layer.
 *
 * ADD-04 FIX: cancelStalePendingOrders() is protected by a ShedLock distributed
 * lock so only one application instance runs the job per firing interval.
 */
@Slf4j
@RestController
@RequestMapping("/api/payments")
@RequiredArgsConstructor
@Tag(name = "Payments")
public class PaymentWebhookController {

    private final RazorpayUtil    razorpayUtil;
    private final OrderRepository orderRepository;
    private final OrderService    orderService;
    private final WalletService   walletService;
    // FIX §1.3: needed for the subscription webhook fallback chain.
    private final VendorService   vendorService;
    // ADD-02: MongoTemplate still needed for the atomic PENDING→CANCELLED claim.
    private final MongoTemplate   mongoTemplate;

    /** Orders still PENDING after this many minutes are considered abandoned. */
    @Value("${app.payment.pending-timeout-minutes:30}")
    private int PENDING_TIMEOUT_MINUTES;

    // ── Webhook ───────────────────────────────────────────────────────────────

    /**
     * Razorpay calls this endpoint (server-to-server) when a payment event fires.
     * Security: No JWT required (Razorpay has no user token), but every request is
     * signature-verified with the webhook secret before any state is changed.
     * The path is already listed in SecurityConfig.PUBLIC_POST.
     */
    @PostMapping("/webhook")
    public ResponseEntity<String> handleWebhook(
            @RequestBody String rawBody,
            @RequestHeader(value = "X-Razorpay-Signature", required = false) String signature) {

        // 1. Reject requests with no signature header immediately.
        if (signature == null || signature.isBlank()) {
            log.warn("Webhook request missing X-Razorpay-Signature header");
            return ResponseEntity.badRequest().body("Missing signature");
        }

        // 2. Verify HMAC-SHA256 signature using the raw body.
        if (!razorpayUtil.verifyWebhookSignature(rawBody, signature)) {
            log.warn("Webhook signature verification failed");
            return ResponseEntity.status(401).body("Invalid signature");
        }

        // 3. Parse and dispatch on event type.
        try {
            JSONObject event = new JSONObject(rawBody);
            String eventType = event.optString("event", "");
            log.info("Razorpay webhook received: {}", eventType);

            if ("payment.captured".equals(eventType)) {
                handlePaymentCaptured(event);
            }
            // Other events (payment.failed, refund.created, etc.) can be handled here.

        } catch (Exception e) {
            // Log but still return 200 so Razorpay does not keep retrying a parse error.
            log.error("Error processing webhook payload: {}", e.getMessage(), e);
        }

        // Always return 200 to acknowledge receipt to Razorpay.
        return ResponseEntity.ok("OK");
    }

    /**
     * Confirms the order when Razorpay reports that the payment was captured.
     * Idempotent: if the order is already CONFIRMED (client path beat the webhook),
     * we log and return without re-running postOrderSuccess.
     *
     * Also handles wallet top-up orders: a payment.captured event's razorpayOrderId
     * may belong to a WalletTopupOrder instead of an Order (the two share the same
     * Razorpay account but are created independently, so IDs never collide). If no
     * matching checkout Order is found, we fall back to checking wallet top-ups
     * before giving up — this is the server-to-server safety net for top-ups in
     * case the client never calls /api/wallet/topup/verify (closed tab, etc).
     */
    private void handlePaymentCaptured(JSONObject event) {
        try {
            JSONObject paymentEntity = event
                    .getJSONObject("payload")
                    .getJSONObject("payment")
                    .getJSONObject("entity");

            String razorpayOrderId   = paymentEntity.getString("order_id");
            String razorpayPaymentId = paymentEntity.getString("id");

            orderRepository.findByRazorpayOrderId(razorpayOrderId).ifPresentOrElse(order -> {
                // Idempotency guard — client verify-payment may have already confirmed it.
                if (order.getStatus() == OrderStatus.CONFIRMED) {
                    log.info("Webhook: order {} already CONFIRMED, skipping", order.getId());
                    return;
                }
                if (order.getStatus() != OrderStatus.PENDING) {
                    log.warn("Webhook: order {} is in status {}, cannot confirm",
                            order.getId(), order.getStatus());
                    return;
                }

                order.setPaymentId(razorpayPaymentId);
                orderService.confirmAllVendorOrders(order);
                orderRepository.save(order);

                // Reuse the same post-success logic (cart clear, vendor credits, notifications).
                orderService.triggerPostOrderSuccess(order);
                log.info("Webhook: order {} confirmed via payment.captured", order.getId());

            }, () -> {
                // FIX §1.3: extend the fallback chain — try wallet top-up first,
                // then vendor subscription. Before this fix, subscriptions had no
                // server-to-server safety net: a vendor who paid but closed their
                // browser tab before /verify was called would never get the plan.
                walletService.confirmTopupFromWebhook(razorpayOrderId, razorpayPaymentId);
                vendorService.confirmSubscriptionFromWebhook(razorpayOrderId, razorpayPaymentId);
            });

        } catch (Exception e) {
            log.error("handlePaymentCaptured error: {}", e.getMessage(), e);
        }
    }

    // ── Scheduled cleanup ─────────────────────────────────────────────────────

    /**
     * Runs every 5 minutes and cancels orders that have been PENDING for longer
     * than PENDING_TIMEOUT_MINUTES.
     *
     * This is the safety net for cases where:
     *   - The Razorpay webhook never arrives (network failure, misconfigured URL).
     *   - The customer abandoned the payment flow entirely.
     *
     * ADD-02 FIX: All rollback side-effects (stock restore, wallet refund, coupon
     * rollback) are now delegated to OrderService.cancelStaleOrder(). There is one
     * authoritative rollback path; the controller only owns the atomic DB claim.
     *
     * ADD-04 FIX: @SchedulerLock ensures only one instance runs per firing interval
     * in a horizontally scaled deployment.  lockAtMostFor caps the lock lifetime so
     * a crashed instance cannot block the job indefinitely.
     */
    @Scheduled(fixedDelayString = "${app.payment.cleanup-interval-ms:300000}")
    @SchedulerLock(
            name            = "cancelStalePendingOrders",
            lockAtMostFor   = "PT4M",   // forcibly released after 4 min even on crash
            lockAtLeastFor  = "PT1M"    // prevents near-immediate double-run on fast clusters
    )
    public void cancelStalePendingOrders() {
        LocalDateTime cutoff = LocalDateTime.now().minusMinutes(PENDING_TIMEOUT_MINUTES);
        List<Order> stale = orderRepository.findByStatusAndPlacedAtBefore(
                OrderStatus.PENDING, cutoff);

        if (!stale.isEmpty()) {
            log.info("Cleanup: found {} stale PENDING orders (older than {} min)",
                    stale.size(), PENDING_TIMEOUT_MINUTES);

            for (Order order : stale) {
                try {
                    // Atomic status transition: only proceed if still PENDING.
                    // If the webhook or another scheduler instance already confirmed or
                    // cancelled this order, findAndModify returns null and we skip it.
                    Query q = Query.query(
                            Criteria.where("_id").is(order.getId())
                                    .and("status").is(OrderStatus.PENDING));
                    Update u = new Update().set("status", OrderStatus.CANCELLED);
                    Order claimed = mongoTemplate.findAndModify(q, u, Order.class);
                    if (claimed == null) continue;

                    // ADD-02: delegate all side-effect rollback to OrderService —
                    // single authoritative path for stock restore, wallet refund,
                    // coupon rollback.  Future additions only need to be made there.
                    orderService.cancelStaleOrder(claimed);

                    log.info("Cleanup: cancelled stale order {}", claimed.getId());

                } catch (Exception e) {
                    log.error("Cleanup: error cancelling order {}: {}", order.getId(), e.getMessage());
                }
            }
        }

        // Wallet top-ups carry no stock/coupon side effects, so there's nothing to
        // roll back beyond marking the order FAILED — reuses the same lock/interval.
        // Runs unconditionally, independent of whether any stale checkout orders existed.
        walletService.expireStaleTopupOrders();
    }
}
