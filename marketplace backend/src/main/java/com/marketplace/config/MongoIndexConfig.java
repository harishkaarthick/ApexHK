package com.marketplace.config;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.data.mongodb.core.index.IndexInfo;
import org.springframework.data.mongodb.core.index.TextIndexDefinition;
import org.springframework.stereotype.Component;

import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class MongoIndexConfig {

    private final MongoTemplate mongoTemplate;

    @PostConstruct
    public void createIndexes() {
        createProductIndexes();
        createOrderIndexes();
        createNotificationIndexes();
        // ISSUE-11 FIX: Add indexes for wallet_transactions collection.
        createWalletTransactionIndexes();
        createWalletTopupOrderIndexes();
        // FIX §4.2: Add indexes for vendor_subscription_orders collection.
        createVendorSubscriptionOrderIndexes();
        log.info("MongoDB indexes verified/created");
    }

    private void createProductIndexes() {
        try {
            var ops = mongoTemplate.indexOps("products");
            ops.ensureIndex(new Index()
                    .on("isActive", Sort.Direction.ASC)
                    .on("category", Sort.Direction.ASC)
                    .on("price",    Sort.Direction.ASC)
                    .named("idx_active_category_price"));
            ops.ensureIndex(new Index()
                    .on("vendorId",  Sort.Direction.ASC)
                    .on("isActive",  Sort.Direction.ASC)
                    .on("createdAt", Sort.Direction.DESC)
                    .named("idx_vendor_active_created"));
            ops.ensureIndex(new Index()
                    .on("isActive",      Sort.Direction.ASC)
                    .on("averageRating", Sort.Direction.DESC)
                    .named("idx_active_rating"));
            ops.ensureIndex(new Index()
                    .on("isActive",   Sort.Direction.ASC)
                    .on("isFeatured", Sort.Direction.ASC)
                    .named("idx_active_featured"));
            ops.ensureIndex(new Index()
                    .on("flashSale.endTime", Sort.Direction.ASC)
                    .named("idx_flash_sale_end_time").sparse());
            ensureProductTextIndex();
            ops.ensureIndex(new Index()
                    .on("isActive", Sort.Direction.ASC)
                    .on("brand",    Sort.Direction.ASC)
                    .on("price",    Sort.Direction.ASC)
                    .named("idx_active_brand_price"));
        } catch (Exception e) {
            log.warn("Product index creation failed: {}", e.getMessage());
        }
    }

    private void ensureProductTextIndex() {
        var ops = mongoTemplate.indexOps("products");
        List<IndexInfo> indexes = ops.getIndexInfo();
        boolean current = indexes.stream().anyMatch(index ->
                index.getName().contains("name_text")
                        && index.getName().contains("subcategory_text")
                        && index.getName().contains("sku_text")
                        && index.getName().contains("tags_text"));
        if (!current) {
            indexes.stream()
                    .filter(index -> index.getName().contains("_text"))
                    .map(IndexInfo::getName)
                    .forEach(ops::dropIndex);
        }
        ops.ensureIndex(new TextIndexDefinition.TextIndexDefinitionBuilder()
                .onField("name",        3f)
                .onField("description", 2f)
                .onField("category")
                .onField("subcategory")
                .onField("brand")
                .onField("sku")
                .onField("tags")
                .build());
    }

    private void createOrderIndexes() {
        try {
            var ops = mongoTemplate.indexOps("orders");
            ops.ensureIndex(new Index()
                    .on("customerId", Sort.Direction.ASC)
                    .on("placedAt",   Sort.Direction.DESC)
                    .named("idx_customer_placed"));
            ops.ensureIndex(new Index()
                    .on("razorpayOrderId", Sort.Direction.ASC)
                    .named("idx_razorpay_order_id").sparse());
            ops.ensureIndex(new Index()
                    .on("items.vendorId", Sort.Direction.ASC)
                    .on("placedAt",       Sort.Direction.DESC)
                    .named("idx_vendor_orders"));
            ops.ensureIndex(new Index()
                    .on("status",   Sort.Direction.ASC)
                    .on("placedAt", Sort.Direction.DESC)
                    .named("idx_status_placed"));
        } catch (Exception e) {
            log.warn("Order index creation failed: {}", e.getMessage());
        }
    }

    private void createNotificationIndexes() {
        try {
            var ops = mongoTemplate.indexOps("notifications");
            ops.ensureIndex(new Index()
                    .on("userId",    Sort.Direction.ASC)
                    .on("isRead",    Sort.Direction.ASC)
                    .on("createdAt", Sort.Direction.DESC)
                    .named("idx_user_read_created"));
        } catch (Exception e) {
            log.warn("Notification index creation failed: {}", e.getMessage());
        }
    }

    /**
     * ISSUE-11 FIX: Add indexes for the wallet_transactions collection.
     *
     * Without these, the two primary query patterns both do a full collection scan:
     *   - findByWalletIdOrderByCreatedAtDesc  (used by WalletService.getTransactions)
     *   - findByUserIdOrderByCreatedAtDesc    (used for per-user history)
     *
     * High-volume users accumulate thousands of transactions; compound indexes on
     * (walletId, createdAt DESC) and (userId, createdAt DESC) make these O(log n).
     */
    private void createWalletTransactionIndexes() {
        try {
            var ops = mongoTemplate.indexOps("wallet_transactions");
            ops.ensureIndex(new Index()
                    .on("walletId",  Sort.Direction.ASC)
                    .on("createdAt", Sort.Direction.DESC)
                    .named("idx_wallet_created"));
            ops.ensureIndex(new Index()
                    .on("userId",    Sort.Direction.ASC)
                    .on("createdAt", Sort.Direction.DESC)
                    .named("idx_user_wallet_created"));
        } catch (Exception e) {
            log.warn("WalletTransaction index creation failed: {}", e.getMessage());
        }
    }

    /**
     * Indexes for the wallet_topup_orders collection (Razorpay-backed wallet
     * top-ups). razorpayOrderId is unique+sparse so two top-up orders can never
     * resolve to the same Razorpay order. userId/status/createdAt back the stale
     * top-up expiry sweep in WalletService.expireStaleTopupOrders().
     */
    private void createWalletTopupOrderIndexes() {
        try {
            var ops = mongoTemplate.indexOps("wallet_topup_orders");
            ops.ensureIndex(new Index()
                    .on("razorpayOrderId", Sort.Direction.ASC)
                    .named("idx_topup_razorpay_order_id").unique().sparse());
            ops.ensureIndex(new Index()
                    .on("status",    Sort.Direction.ASC)
                    .on("createdAt", Sort.Direction.ASC)
                    .named("idx_topup_status_created"));
            ops.ensureIndex(new Index()
                    .on("userId", Sort.Direction.ASC)
                    .named("idx_topup_user"));
        } catch (Exception e) {
            log.warn("WalletTopupOrder index creation failed: {}", e.getMessage());
        }
    }

    /**
     * FIX §4.2: Indexes for vendor_subscription_orders.
     *
     * - razorpayOrderId: unique+sparse — prevents two subscription orders from
     *   ever mapping to the same Razorpay payment (closes replay §1.2 at DB level).
     * - (vendorId, createdAt DESC): backs GET /subscription/history pagination.
     * - (status, createdAt ASC): backs the stale-PENDING cleanup query.
     */
    private void createVendorSubscriptionOrderIndexes() {
        try {
            var ops = mongoTemplate.indexOps("vendor_subscription_orders");
            ops.ensureIndex(new Index()
                    .on("razorpayOrderId", Sort.Direction.ASC)
                    .named("idx_sub_order_razorpay_order_id").unique().sparse());
            ops.ensureIndex(new Index()
                    .on("vendorId",  Sort.Direction.ASC)
                    .on("createdAt", Sort.Direction.DESC)
                    .named("idx_sub_order_vendor_created"));
            ops.ensureIndex(new Index()
                    .on("status",    Sort.Direction.ASC)
                    .on("createdAt", Sort.Direction.ASC)
                    .named("idx_sub_order_status_created"));
        } catch (Exception e) {
            log.warn("VendorSubscriptionOrder index creation failed: {}", e.getMessage());
        }
    }
}
