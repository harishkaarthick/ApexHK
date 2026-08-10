package com.marketplace.repository;

import com.marketplace.model.Review;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ReviewRepository extends MongoRepository<Review, String> {
    Page<Review> findByProductIdAndIsHiddenFalse(String productId, Pageable pageable);
    Optional<Review> findByCustomerIdAndProductId(String customerId, String productId);
    boolean existsByCustomerIdAndProductId(String customerId, String productId);
    List<Review> findByCustomerIdAndProductIdIn(String customerId, List<String> productIds);
    List<Review> findByProductId(String productId);
    Page<Review> findByIsApprovedFalse(Pageable pageable);
}
