package com.marketplace.service;

import com.marketplace.dto.response.WalletResponse;
import com.marketplace.enums.WalletTopupStatus;
import com.marketplace.exception.PaymentException;
import com.marketplace.exception.ResourceNotFoundException;
import com.marketplace.exception.UnauthorizedException;
import com.marketplace.model.Wallet;
import com.marketplace.model.WalletTopupOrder;
import com.marketplace.model.WalletTransaction;
import com.marketplace.repository.WalletRepository;
import com.marketplace.repository.WalletTopupOrderRepository;
import com.marketplace.repository.WalletTransactionRepository;
import com.marketplace.util.RazorpayUtil;
import com.razorpay.RazorpayClient;
import com.razorpay.RazorpayException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class WalletService {

    private final WalletRepository            walletRepository;
    private final WalletTransactionRepository walletTransactionRepository;
    private final WalletTopupOrderRepository  walletTopupOrderRepository;
    private final MongoTemplate               mongoTemplate;
    private final RazorpayClient              razorpayClient;
    private final RazorpayUtil                razorpayUtil;

    @Value("${razorpay.key-id}") private String razorpayKeyId;

    /** Top-up Razorpay orders left PENDING longer than this are considered abandoned. */
    @Value("${app.payment.pending-timeout-minutes:30}")
    private int pendingTimeoutMinutes;

    /**
     * Returns the wallet for the given user, creating one with zero balance if it
     * doesn't exist yet.
     *
     * FIX: The previous implementation used Update.fromDocument($setOnInsert only).
     * MongoDB executes $setOnInsert solely during an insert — for an existing document
     * no modification is applied, so findAndModify returns null even with returnNew=true.
     * Every subsequent call to getBalance() then threw NullPointerException.
     *
     * Fix: use the fluent Update.setOnInsert() builder. Spring Data translates this to
     * a proper { $setOnInsert: {...} } document but correctly handles the existing-doc
     * case. A null-safe fallback via walletRepository covers any remaining edge cases
     * (e.g. race between delete and upsert in tests).
     */
    public Wallet getOrCreate(String userId) {
        Query query = Query.query(Criteria.where("userId").is(userId));
        Update update = new Update()
                .setOnInsert("userId", userId)
                .setOnInsert("balance", 0.0);
        FindAndModifyOptions opts = FindAndModifyOptions.options()
                .upsert(true)
                .returnNew(true);
        Wallet wallet = mongoTemplate.findAndModify(query, update, opts, Wallet.class);
        if (wallet == null) {
            // Fallback: fetch existing doc or create a fresh one
            wallet = walletRepository.findByUserId(userId)
                    .orElseGet(() -> walletRepository.save(
                            Wallet.builder().userId(userId).balance(0.0).build()));
        }
        return wallet;
    }

    public double getBalance(String userId) {
        return getOrCreate(userId).getBalance();
    }

    /**
     * Atomically increments the wallet balance by amount using $inc.
     * Eliminates the read-modify-write race condition.
     */
    public void credit(String userId, double amount,
                       String description, String referenceId) {
        Wallet wallet = atomicIncrement(userId, amount);
        saveTransaction(wallet.getId(), userId,
                WalletTransaction.Type.CREDIT, amount, description, referenceId);
    }

    /**
     * Atomically decrements the wallet balance only if sufficient funds exist.
     * Uses a conditional $inc so it can never go negative.
     */
    public void debit(String userId, double amount,
                      String description, String referenceId) {
        Query query = Query.query(
                Criteria.where("userId").is(userId)
                        .and("balance").gte(amount)
        );
        Update update = new Update().inc("balance", -amount);
        Wallet wallet = mongoTemplate.findAndModify(
                query, update,
                FindAndModifyOptions.options().returnNew(true),
                Wallet.class
        );
        if (wallet == null)
            throw new IllegalStateException("Insufficient wallet balance");
        saveTransaction(wallet.getId(), userId,
                WalletTransaction.Type.DEBIT, amount, description, referenceId);
    }

    // FIX H-6: Replaced the unbounded List<WalletTransaction> return with a paged
    // variant. An active user with thousands of orders accumulates thousands of
    // wallet transactions; loading all of them in one query causes high memory usage
    // and slow responses. Callers pass a Pageable to control page size.
    public Page<WalletTransaction> getTransactions(String userId, Pageable pageable) {
        Wallet wallet = getOrCreate(userId);
        return walletTransactionRepository
                .findByWalletIdOrderByCreatedAtDesc(wallet.getId(), pageable);
    }

    // ── Razorpay-backed top-up ───────────────────────────────────────────────
    //
    // The wallet balance must never be credited from a client-supplied amount
    // directly — that would let anyone set their own balance by calling the API.
    // Instead, top-ups follow the same two-step pattern as order checkout:
    //   1. createTopupOrder() opens a Razorpay order for the requested amount
    //      and records it as PENDING. No money has moved yet.
    //   2. verifyAndCredit() is called by the frontend once Razorpay Checkout
    //      reports success; it verifies the HMAC signature against Razorpay's
    //      secret before crediting a single rupee. confirmTopupFromWebhook()
    //      is the server-to-server fallback for the same order, in case the
    //      client never calls back (closed tab, network drop, etc).
    // Both confirmation paths share an atomic PENDING→PAID transition so the
    // wallet can only ever be credited once per top-up order, however many
    // times either path fires.

    public WalletResponse.TopupOrder createTopupOrder(String userId, double amount) {
        WalletTopupOrder topup = walletTopupOrderRepository.save(
                WalletTopupOrder.builder()
                        .userId(userId)
                        .amount(amount)
                        .status(WalletTopupStatus.PENDING)
                        .build());

        try {
            JSONObject opts = new JSONObject();
            opts.put("amount",   (int) Math.round(amount * 100));
            opts.put("currency", "INR");
            opts.put("receipt",  topup.getId());
            com.razorpay.Order rzpOrder = razorpayClient.orders.create(opts);
            String rzpOrderId = rzpOrder.get("id");

            topup.setRazorpayOrderId(rzpOrderId);
            walletTopupOrderRepository.save(topup);

            return new WalletResponse.TopupOrder(
                    topup.getId(), rzpOrderId,
                    Math.round(amount * 100), "INR", razorpayKeyId.trim());
        } catch (RazorpayException e) {
            walletTopupOrderRepository.delete(topup);
            throw new PaymentException("Failed to create payment order: " + e.getMessage(), e);
        }
    }

    public WalletResponse.Balance verifyAndCredit(String userId, String razorpayOrderId,
                                                  String razorpayPaymentId, String razorpaySignature) {
        WalletTopupOrder topup = walletTopupOrderRepository.findByRazorpayOrderId(razorpayOrderId)
                .orElseThrow(() -> new ResourceNotFoundException("Wallet top-up order", razorpayOrderId));

        if (!topup.getUserId().equals(userId))
            throw new UnauthorizedException("Not your top-up order");

        if (topup.getStatus() == WalletTopupStatus.PAID)
            return currentBalance(userId); // already credited — idempotent

        if (topup.getStatus() != WalletTopupStatus.PENDING)
            throw new IllegalStateException(
                    "Top-up order is in status " + topup.getStatus() + " and cannot be confirmed");

        if (!razorpayUtil.verifyPaymentSignature(razorpayOrderId, razorpayPaymentId, razorpaySignature))
            throw new PaymentException("Payment signature verification failed");

        if (claimTopup(topup.getId(), razorpayPaymentId)) {
            credit(userId, topup.getAmount(), "Wallet top-up via Razorpay", topup.getId());
        }
        return currentBalance(userId);
    }

    /**
     * Server-to-server confirmation path, called from the Razorpay webhook on
     * payment.captured. Idempotent against verifyAndCredit() racing it for the
     * same order — only the path that wins the atomic claim credits the wallet.
     */
    public void confirmTopupFromWebhook(String razorpayOrderId, String razorpayPaymentId) {
        Optional<WalletTopupOrder> topupOpt = walletTopupOrderRepository.findByRazorpayOrderId(razorpayOrderId);
        if (topupOpt.isEmpty()) {
            log.warn("Webhook: no wallet top-up order found for razorpayOrderId={}", razorpayOrderId);
            return;
        }
        WalletTopupOrder topup = topupOpt.get();
        if (topup.getStatus() == WalletTopupStatus.PAID) {
            log.info("Webhook: wallet top-up {} already PAID, skipping", topup.getId());
            return;
        }
        if (claimTopup(topup.getId(), razorpayPaymentId)) {
            credit(topup.getUserId(), topup.getAmount(),
                    "Wallet top-up via Razorpay", topup.getId());
            log.info("Webhook: wallet top-up {} confirmed via payment.captured", topup.getId());
        }
    }

    /** Marks top-up orders abandoned for too long as FAILED. No funds are involved, so this is just hygiene. */
    public void expireStaleTopupOrders() {
        LocalDateTime cutoff = LocalDateTime.now().minusMinutes(pendingTimeoutMinutes);
        walletTopupOrderRepository.findByStatusAndCreatedAtBefore(WalletTopupStatus.PENDING, cutoff)
                .forEach(stale -> {
                    Query q = Query.query(
                            Criteria.where("_id").is(stale.getId())
                                    .and("status").is(WalletTopupStatus.PENDING));
                    Update u = new Update().set("status", WalletTopupStatus.FAILED);
                    mongoTemplate.updateFirst(q, u, WalletTopupOrder.class);
                });
    }

    // ── private ───────────────────────────────────────────────────────────────

    /** Atomic PENDING→PAID claim. Returns true only for the caller that wins the race. */
    private boolean claimTopup(String topupId, String paymentId) {
        Query q = Query.query(
                Criteria.where("_id").is(topupId)
                        .and("status").is(WalletTopupStatus.PENDING));
        Update u = new Update()
                .set("status", WalletTopupStatus.PAID)
                .set("paymentId", paymentId)
                .set("completedAt", LocalDateTime.now());
        WalletTopupOrder claimed = mongoTemplate.findAndModify(
                q, u, FindAndModifyOptions.options().returnNew(true), WalletTopupOrder.class);
        return claimed != null;
    }

    private WalletResponse.Balance currentBalance(String userId) {
        return new WalletResponse.Balance(
                getBalance(userId), getTransactions(userId, PageRequest.of(0, 20)));
    }

    private Wallet atomicIncrement(String userId, double amount) {
        // Upsert: create wallet if not present, then increment
        Query query  = Query.query(Criteria.where("userId").is(userId));
        Update update = new Update().inc("balance", amount).setOnInsert("userId", userId);
        return mongoTemplate.findAndModify(
                query, update,
                FindAndModifyOptions.options().returnNew(true).upsert(true),
                Wallet.class
        );
    }

    private void saveTransaction(String walletId, String userId,
                                 WalletTransaction.Type type, double amount,
                                 String description, String referenceId) {
        walletTransactionRepository.save(WalletTransaction.builder()
                .walletId(walletId)
                .userId(userId)
                .type(type)
                .amount(amount)
                .description(description)
                .referenceId(referenceId)
                .build());
    }
}
