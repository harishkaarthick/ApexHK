// ─────────────────────────────────────────────────────────────────────────────
// FILE 1 of 2:  ProductRepository.java
// Add countByVendorIdAndIsActiveTrue so the limit check is precise.
// ─────────────────────────────────────────────────────────────────────────────

// package com.marketplace.repository;
//
// Add this method to the existing ProductRepository interface:
//
//   long countByVendorIdAndIsActiveTrue(String vendorId);
//
// Full updated file:

package com.marketplace.repository;

import com.marketplace.model.Product;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProductRepository extends MongoRepository<Product, String> {
    Page<Product> findByIsActiveTrue(Pageable pageable);
    Page<Product> findByVendorId(String vendorId, Pageable pageable);
    Page<Product> findByVendorIdAndIsActiveTrue(String vendorId, Pageable pageable);
    Page<Product> findByCategoryIgnoreCaseAndIsActiveTrue(String category, Pageable pageable);
    List<Product> findByIsActiveTrueAndIsFeaturedTrue();

    // ── NEW: count active products for a vendor (used by plan limit check) ───
    long countByVendorIdAndIsActiveTrue(String vendorId);

    @Query("{ $text: { $search: ?0 }, 'isActive': true }")
    Page<Product> searchByText(String keyword, Pageable pageable);

    @Query("{ 'isActive': true, 'price': { $gte: ?0, $lte: ?1 } }")
    Page<Product> findByIsActiveTrueAndPriceBetween(double minPrice, double maxPrice, Pageable pageable);

    boolean existsByIdAndVendorId(String id, String vendorId);
}
