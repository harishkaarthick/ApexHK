package com.marketplace.repository;

import com.marketplace.model.WalletTransaction;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface WalletTransactionRepository extends MongoRepository<WalletTransaction, String> {
    // FIX H-6: Paged overloads prevent OOM when a user has thousands of transactions.
    // The old List-returning methods are kept for internal callers that genuinely
    // need all rows (none currently exist — they can be removed in a follow-up cleanup).
    Page<WalletTransaction> findByWalletIdOrderByCreatedAtDesc(String walletId, Pageable pageable);
    Page<WalletTransaction> findByUserIdOrderByCreatedAtDesc(String userId, Pageable pageable);

    // Legacy unbounded variants — kept for any future internal callers; do not use from API paths.
    List<WalletTransaction> findByWalletIdOrderByCreatedAtDesc(String walletId);
    List<WalletTransaction> findByUserIdOrderByCreatedAtDesc(String userId);
}