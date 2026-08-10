package com.marketplace.repository;

import com.marketplace.enums.SubscriptionStatus;
import com.marketplace.enums.VendorStatus;
import com.marketplace.model.Vendor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface VendorRepository extends MongoRepository<Vendor, String> {
    Optional<Vendor> findByUserId(String userId);
    boolean existsByUserId(String userId);
    Page<Vendor> findByStatus(VendorStatus status, Pageable pageable);
    long countByStatus(VendorStatus status);
    List<Vendor> findBySubscriptionStatusAndSubscriptionValidUntilBefore(
            SubscriptionStatus status, LocalDateTime cutoff);
}