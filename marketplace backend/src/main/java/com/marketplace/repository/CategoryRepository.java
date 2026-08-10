package com.marketplace.repository;

import com.marketplace.enums.CategoryStatus;
import com.marketplace.model.Category;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface CategoryRepository extends MongoRepository<Category, String> {
    List<Category> findByStatusOrderByNameAsc(CategoryStatus status);
    Optional<Category> findByNameKey(String nameKey);
    boolean existsByStatus(CategoryStatus status);
}
