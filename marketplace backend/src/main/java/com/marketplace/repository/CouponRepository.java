package com.marketplace.repository;

import com.marketplace.model.Coupon;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Optional;

@Repository
public interface CouponRepository extends MongoRepository<Coupon, String> {
    Optional<Coupon> findByCodeIgnoreCase(String code);
    boolean existsByCodeIgnoreCase(String code);
    Page<Coupon> findByIsActiveTrue(Pageable pageable);
    Page<Coupon> findByExpiresAtAfterAndIsActiveTrue(LocalDateTime now, Pageable pageable);
    long countByIsActiveTrue();
}
