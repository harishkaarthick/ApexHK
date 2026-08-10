package com.marketplace.repository;

import com.marketplace.enums.OrderStatus;
import com.marketplace.model.Order;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.Aggregation;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface OrderRepository extends MongoRepository<Order, String> {

    Page<Order> findByCustomerIdOrderByPlacedAtDesc(String customerId, Pageable pageable);

    // FIX BUG 2: was missing — caused O(n) full table scan in verifyAndConfirm()
    Optional<Order> findByRazorpayOrderId(String razorpayOrderId);

    @Query("{ 'items.vendorId': ?0 }")
    Page<Order> findByVendorId(String vendorId, Pageable pageable);

    @Query("{ 'items.vendorId': ?0, 'status': ?1 }")
    List<Order> findByVendorIdAndStatus(String vendorId, OrderStatus status);

    // Replaced the unbounded List<Order> variant — use only for non-review paths that
    // genuinely need all orders. ReviewService must use existsDeliveredOrderWithProduct instead.
    List<Order> findByCustomerIdAndStatus(String customerId, OrderStatus status);

    /**
     * Single-document existence check pushed entirely to MongoDB.
     * Replaces the full List load in ReviewService.create() to avoid OOM on large histories.
     */
    @Query(value = "{ 'customerId': ?0, 'status': 'DELIVERED', 'items.productId': ?1 }",
            exists = true)
    boolean existsDeliveredOrderWithProduct(String customerId, String productId);

    /**
     * ISSUE-10 FIX: Find orders stuck in a given status before a cutoff timestamp.
     * Used by the scheduled cleanup job in PaymentWebhookController to cancel stale
     * PENDING orders whose payment window has expired.
     */
    List<Order> findByStatusAndPlacedAtBefore(OrderStatus status, java.time.LocalDateTime before);

    long countByStatus(OrderStatus status);

    /** Used by CouponService to evaluate firstOrderOnly / NEW-vs-RETURNING targeting. */
    boolean existsByCustomerId(String customerId);

    @Aggregation(pipeline = {
            "{ '$group': { '_id': null, 'total': { '$sum': '$totalAmount' } } }",
            "{ '$project': { '_id': 0, 'total': 1 } }"
    })
    Double sumTotalRevenue();
}
