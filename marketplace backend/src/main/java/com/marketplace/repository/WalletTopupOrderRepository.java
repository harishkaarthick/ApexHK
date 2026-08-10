package com.marketplace.repository;

import com.marketplace.enums.WalletTopupStatus;
import com.marketplace.model.WalletTopupOrder;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface WalletTopupOrderRepository extends MongoRepository<WalletTopupOrder, String> {
    Optional<WalletTopupOrder> findByRazorpayOrderId(String razorpayOrderId);

    List<WalletTopupOrder> findByStatusAndCreatedAtBefore(WalletTopupStatus status, LocalDateTime cutoff);
}
