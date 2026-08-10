package com.marketplace.repository;

import com.marketplace.enums.PayoutStatus;
import com.marketplace.model.PayoutRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.Aggregation;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PayoutRequestRepository extends MongoRepository<PayoutRequest, String> {
    Page<PayoutRequest> findByStatus(PayoutStatus status, Pageable pageable);
    long countByStatus(PayoutStatus status);
    boolean existsByVendorIdAndStatus(String vendorId, PayoutStatus status);
    Page<PayoutRequest> findByVendorIdOrderByRequestedAtDesc(String vendorId, Pageable pageable);

    @Aggregation(pipeline = {
            "{ '$match': { 'status': { '$in': ['APPROVED', 'PAID'] } } }",
            "{ '$group': { '_id': null, 'total': { '$sum': '$amount' } } }"
    })
    Double sumApprovedOrPaidAmount();
}