package com.marketplace.repository;

import com.marketplace.enums.SubscriptionStatus;
import com.marketplace.model.VendorSubscriptionOrder;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface VendorSubscriptionOrderRepository extends MongoRepository<VendorSubscriptionOrder, String> {
    Optional<VendorSubscriptionOrder> findByRazorpayOrderId(String razorpayOrderId);
    Page<VendorSubscriptionOrder> findByVendorIdOrderByCreatedAtDesc(String vendorId, Pageable pageable);
    List<VendorSubscriptionOrder> findByStatusAndCreatedAtBefore(SubscriptionStatus status, LocalDateTime cutoff);
}
