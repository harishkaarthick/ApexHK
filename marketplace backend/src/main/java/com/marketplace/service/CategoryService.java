package com.marketplace.service;

import com.marketplace.dto.response.CategoryResponse;
import com.marketplace.enums.CategoryStatus;
import com.marketplace.exception.BadRequestException;
import com.marketplace.exception.ResourceNotFoundException;
import com.marketplace.model.Category;
import com.marketplace.repository.CategoryRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.text.Normalizer;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class CategoryService {

    private static final List<String> DEFAULT_CATEGORIES = List.of(
            "Electronics", "Clothing", "Books", "Home & Garden", "Sports", "Beauty", "Toys"
    );
    private static final Pattern NON_SLUG = Pattern.compile("[^a-z0-9]+");

    private final CategoryRepository categoryRepository;

    @PostConstruct
    public void seedCategories() {
        if (categoryRepository.count() > 0) return;
        DEFAULT_CATEGORIES.forEach(name -> categoryRepository.save(newCategory(name, CategoryStatus.ACTIVE, null)));
    }

    @Cacheable("activeCategories")
    public List<CategoryResponse> getActiveCategories() {
        return categoryRepository.findByStatusOrderByNameAsc(CategoryStatus.ACTIVE)
                .stream().map(this::toResponse).toList();
    }

    public List<CategoryResponse> getPendingCategories() {
        return categoryRepository.findByStatusOrderByNameAsc(CategoryStatus.PENDING)
                .stream().map(this::toResponse).toList();
    }

    @CacheEvict(value = "activeCategories", allEntries = true)
    public CategoryResponse requestCategory(String name, String vendorId) {
        String normalized = normalizeName(name);
        return categoryRepository.findByNameKey(nameKey(normalized))
                .map(this::toResponse)
                .orElseGet(() -> toResponse(categoryRepository.save(
                        newCategory(normalized, CategoryStatus.PENDING, vendorId))));
    }

    @CacheEvict(value = "activeCategories", allEntries = true)
    public CategoryResponse approveCategory(String categoryId) {
        Category category = findById(categoryId);
        category.setStatus(CategoryStatus.ACTIVE);
        return toResponse(categoryRepository.save(category));
    }

    public void rejectCategory(String categoryId) {
        Category category = findById(categoryId);
        if (category.getStatus() == CategoryStatus.ACTIVE) {
            throw new BadRequestException("Active categories cannot be rejected");
        }
        categoryRepository.delete(category);
    }

    public void ensureActiveCategory(String name) {
        String normalized = normalizeName(name);
        Category category = categoryRepository.findByNameKey(nameKey(normalized))
                .orElseThrow(() -> new BadRequestException("Category is not active"));
        if (category.getStatus() != CategoryStatus.ACTIVE) {
            throw new BadRequestException("Category is not active");
        }
    }

    private Category findById(String categoryId) {
        return categoryRepository.findById(categoryId)
                .orElseThrow(() -> new ResourceNotFoundException("Category", categoryId));
    }

    private Category newCategory(String name, CategoryStatus status, String vendorId) {
        return Category.builder()
                .name(name)
                .nameKey(nameKey(name))
                .slug(slugify(name))
                .status(status)
                .requestedByVendorId(vendorId)
                .build();
    }

    private String normalizeName(String name) {
        if (name == null || name.isBlank()) throw new BadRequestException("Category name is required");
        String normalized = name.trim().replaceAll("\\s+", " ");
        if (normalized.length() > 80) throw new BadRequestException("Category name is too long");
        return normalized;
    }

    private String nameKey(String name) {
        return name.toLowerCase(Locale.ROOT);
    }

    private String slugify(String name) {
        String ascii = Normalizer.normalize(name, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        String slug = NON_SLUG.matcher(ascii.toLowerCase(Locale.ROOT)).replaceAll("-")
                .replaceAll("(^-|-$)", "");
        return slug.isBlank() ? "category" : slug;
    }

    private CategoryResponse toResponse(Category category) {
        return CategoryResponse.builder()
                .id(category.getId())
                .name(category.getName())
                .slug(category.getSlug())
                .status(category.getStatus())
                .requestedByVendorId(category.getRequestedByVendorId())
                .createdAt(category.getCreatedAt())
                .build();
    }
}
