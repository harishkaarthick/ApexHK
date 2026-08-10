package com.marketplace.repository;

import com.marketplace.enums.*;
import com.marketplace.model.ReturnRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.Aggregation;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ReturnRepository extends MongoRepository<ReturnRequest, String> {
    List<ReturnRequest> findByOrderId(String orderId);
    Page<ReturnRequest> findByCustomerId(String customerId, Pageable pageable);
    Page<ReturnRequest> findByStatus(ReturnStatus status, Pageable pageable);
    Page<ReturnRequest> findByVendorIdAndStatus(String vendorId, ReturnStatus status, Pageable pageable);
    Page<ReturnRequest> findByVendorId(String vendorId, Pageable pageable);
    long countByStatus(ReturnStatus status);

    // Used in ReturnService.create() to prevent a customer from submitting
    // multiple return requests for the exact same order item.
    boolean existsByOrderIdAndOrderItemId(String orderId, String orderItemId);

    // Legacy product-level duplicate check retained for older callers/tests.
    boolean existsByOrderIdAndProductId(String orderId, String productId);

    // New methods for enhanced return workflow
    Page<ReturnRequest> findByVendorIdAndStatusIn(String vendorId, List<ReturnStatus> statuses, Pageable pageable);
    Page<ReturnRequest> findByStatusIn(List<ReturnStatus> statuses, Pageable pageable);
    List<ReturnRequest> findByOrderItemId(String orderItemId);
    long countByVendorIdAndStatusIn(String vendorId, List<ReturnStatus> statuses);
    long countByStatusIn(List<ReturnStatus> statuses);
    List<ReturnRequest> findByOrderItemIdAndCustomerId(String orderItemId, String customerId);

    // Issue 1 fix: MongoDB aggregation to sum refundAmount for REFUNDED returns.
    // Replaces the findAll().stream() full table scan in getReturnsAnalytics().
    @Aggregation(pipeline = {
            "{ '$match': { 'status': 'REFUNDED' } }",
            "{ '$group': { '_id': null, 'total': { '$sum': '$refundAmount' } } }"
    })
    Double sumRefundedAmount();
}
