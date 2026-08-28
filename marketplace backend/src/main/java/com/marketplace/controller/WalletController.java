package com.marketplace.controller;

import com.marketplace.dto.request.WalletRequest;
import com.marketplace.dto.response.ApiResponse;
import com.marketplace.dto.response.WalletResponse;
import com.marketplace.security.SecurityUtil;
import com.marketplace.service.WalletService;
import com.marketplace.util.PaginationUtils;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/wallet")
@RequiredArgsConstructor
@Tag(name = "Wallet")
public class WalletController {

    private final WalletService walletService;

    // FIX H-6: Transactions are now paginated. Previously getTransactions() loaded
    // every transaction in one query — unbounded for active users with large histories.
    @GetMapping
    public ResponseEntity<?> balance(
            @RequestParam(defaultValue = "0")  int page,
            @RequestParam(defaultValue = "20") int size) {
        String userId = SecurityUtil.currentUserId();
        return ApiResponse.ok(new WalletResponse.Balance(
                walletService.getBalance(userId),
                walletService.getTransactions(userId, PaginationUtils.page(page, size))));
    }

    /**
     * SECURITY FIX: the old POST /top-up endpoint credited the wallet directly
     * from a client-supplied amount with no payment behind it — anyone could add
     * money to their own wallet for free. Top-ups now go through Razorpay, the
     * same as order checkout:
     *   1. POST /topup/create-order opens a Razorpay order for the requested
     *      amount and returns the details needed to launch Razorpay Checkout.
     *      No balance changes here.
     *   2. POST /topup/verify is called once Razorpay reports a successful
     *      payment; the signature is verified server-side before the wallet
     *      is credited. The webhook (PaymentWebhookController) provides the
     *      same confirmation server-to-server as a fallback.
     */
    @PostMapping("/topup/create-order")
    public ResponseEntity<?> createTopupOrder(@Valid @RequestBody WalletRequest.CreateTopup req) {
        String userId = SecurityUtil.currentUserId();
        return ApiResponse.ok(walletService.createTopupOrder(userId, req.getAmount()));
    }

    @PostMapping("/topup/verify")
    public ResponseEntity<?> verifyTopup(@Valid @RequestBody WalletRequest.VerifyTopup req) {
        String userId = SecurityUtil.currentUserId();
        return ApiResponse.ok("Wallet topped up", walletService.verifyAndCredit(
                userId, req.getRazorpayOrderId(), req.getRazorpayPaymentId(), req.getRazorpaySignature()));
    }
}
