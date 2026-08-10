package com.marketplace.service;

import com.marketplace.config.PlanConfig;
import com.marketplace.dto.request.ProductRequest;
import com.marketplace.dto.response.*;
import com.marketplace.enums.VendorStatus;
import com.marketplace.exception.*;
import com.marketplace.model.*;
import com.marketplace.repository.ProductRepository;
import com.marketplace.repository.VendorRepository;
import com.marketplace.util.CloudinaryUploader;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.*;
import org.springframework.data.domain.*;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class ProductService {

    private final ProductRepository  productRepository;
    private final VendorRepository   vendorRepository;
    private final CloudinaryUploader cloudinaryUploader;
    private final CategoryService    categoryService;
    private final MongoTemplate      mongoTemplate;
    private final ProductSearchService productSearchService;

    @Cacheable(value = "products",
            key   = "#pageable.pageNumber + '-' + #pageable.pageSize + '-' + #pageable.sort")
    public PagedResponse<ProductResponse> getAllActive(Pageable pageable) {
        return PagedResponse.of(
                productRepository.findByIsActiveTrue(pageable).map(this::toResponse));
    }

    @Cacheable(value = "product", key = "#id")
    public ProductResponse getById(String id) {
        return toResponse(findActiveById(id));
    }

    public PagedResponse<ProductResponse> getByCategory(String category, Pageable pageable) {
        return PagedResponse.of(
                productRepository.findByCategoryIgnoreCaseAndIsActiveTrue(category, pageable)
                        .map(this::toResponse));
    }

    public PagedResponse<ProductResponse> search(String keyword, Pageable pageable) {
        if (keyword == null || keyword.isBlank()) {
            return getAllActive(pageable);
        }
        return PagedResponse.of(
                productRepository.searchByText(keyword, pageable).map(this::toResponse));
    }

    public ProductSearchResponse search(String keyword, Pageable pageable,
                                        String category, String brand,
                                        Double minPrice, Double maxPrice,
                                        Double minRating, Boolean inStock,
                                        String sort) {
        return productSearchService.search(keyword, pageable, category, brand, minPrice,
                maxPrice, minRating, inStock, sort, this);
    }

    public ProductSearchResponse autocomplete(String keyword) {
        return productSearchService.autocomplete(keyword, this);
    }

    public List<ProductResponse> getFeatured() {
        return productRepository.findByIsActiveTrueAndIsFeaturedTrue()
                .stream().map(this::toResponse).toList();
    }

    public PagedResponse<ProductResponse> getVendorProducts(String vendorId, Pageable pageable) {
        return PagedResponse.of(
                productRepository.findByVendorIdAndIsActiveTrue(vendorId, pageable)
                        .map(this::toResponse));
    }

    @CacheEvict(value = "products", allEntries = true)
    public ProductResponse create(String vendorId, String vendorName,
                                  ProductRequest.Create req,
                                  List<MultipartFile> images) {
        Vendor vendor = vendorRepository.findById(vendorId)
                .orElseThrow(() -> new ResourceNotFoundException("Vendor", vendorId));

        if (vendor.getStatus() != VendorStatus.APPROVED)
            throw new UnauthorizedException(
                    "Your vendor account must be approved before listing products");

        // FIX §3.1 / §4.6: Check subscription expiry inline so an expired paid plan
        // cannot keep granting its old (potentially unlimited) product limit.
        // The expiry scheduler (SubscriptionExpiryScheduler) corrects vendor.productLimit
        // hourly, but this inline check is the defense-in-depth safety net between sweeps.
        boolean expired = vendor.getSubscriptionValidUntil() != null
                && vendor.getSubscriptionValidUntil().isBefore(java.time.LocalDateTime.now())
                && !"FREE".equalsIgnoreCase(vendor.getSubscriptionPlan());
        int effectiveLimit = expired ? PlanConfig.FREE.getProductLimit() : vendor.getProductLimit();

        // FIX §3.3: Replace the old check-then-act (TOCTOU race) with an atomic
        // findAndModify that increments the counter only when still under the limit.
        // Two concurrent requests at the limit can no longer both pass and both insert.
        // For unlimited plans (effectiveLimit == -1) we skip the gate but still track.
        if (effectiveLimit != -1) {
            Query limitQuery = Query.query(
                    Criteria.where("_id").is(vendorId)
                            .and("activeProductCount").lt(effectiveLimit));
            Update limitUpdate = new Update().inc("activeProductCount", 1);
            Vendor claimed = mongoTemplate.findAndModify(limitQuery, limitUpdate, Vendor.class);
            if (claimed == null) {
                throw new BadRequestException(expired
                        ? "Your subscription has expired and you are now on the FREE plan. "
                          + "Renew to add more products."
                        : "Product limit reached for your plan. Upgrade to add more.");
            }
        } else {
            // Unlimited plan — still track the count for observability, no gate needed.
            mongoTemplate.updateFirst(
                    Query.query(Criteria.where("_id").is(vendorId)),
                    new Update().inc("activeProductCount", 1),
                    Vendor.class);
        }

        categoryService.ensureActiveCategory(req.getCategory());

        List<String> urls = uploadImages(images, "products");
        log.info("Product create imageUrls before save: {}", urls);

        Product product = Product.builder()
                .vendorId(vendorId)
                .vendorName(vendorName)
                .name(req.getName())
                .description(req.getDescription())
                .category(req.getCategory())
                .subcategory(req.getSubcategory())
                .brand(req.getBrand())
                .sku(req.getSku())
                .tags(req.getTags() != null ? req.getTags() : List.of())
                .price(req.getPrice())
                .discountedPrice(req.getDiscountedPrice())
                .stock(req.getStock())
                .isFeatured(Boolean.TRUE.equals(req.getFeatured()))
                .specifications(req.getSpecifications() != null
                        ? req.getSpecifications()
                        : new HashMap<>())
                .imageUrls(urls)
                .build();

        return toResponse(productRepository.save(product));
    }

    @CacheEvict(value = {"products", "product"}, allEntries = true)
    public ProductResponse update(String productId, String vendorId,
                                  ProductRequest.Update req,
                                  List<MultipartFile> newImages) {
        // FIX §3.2: Rejected/banned vendors previously had no check here at all —
        // they could edit existing listings freely. Require APPROVED status.
        requireApprovedVendor(vendorId);
        Product product = findByIdAndVendor(productId, vendorId);

        if (req.getName()        != null) product.setName(req.getName());
        if (req.getDescription() != null) product.setDescription(req.getDescription());
        if (req.getCategory()    != null) {
            categoryService.ensureActiveCategory(req.getCategory());
            product.setCategory(req.getCategory());
        }
        if (req.getSubcategory() != null) product.setSubcategory(req.getSubcategory());
        if (req.getBrand()       != null) product.setBrand(req.getBrand());
        if (req.getSku()         != null) product.setSku(req.getSku());
        if (req.getTags()        != null) product.setTags(req.getTags());
        if (req.getPrice()           != null) product.setPrice(req.getPrice());
        if (req.getDiscountedPrice() != null) product.setDiscountedPrice(req.getDiscountedPrice());
        if (req.getStock()           != null) product.setStock(req.getStock());
        if (req.getFeatured() != null) product.setFeatured(req.getFeatured());
        if (req.getActive()   != null) product.setActive(req.getActive());
        if (req.getSpecifications() != null) product.setSpecifications(req.getSpecifications());

        if (newImages != null && !newImages.isEmpty()) {
            if (product.getImageUrls() == null) {
                product.setImageUrls(new ArrayList<>());
            }
            product.getImageUrls().addAll(uploadImages(newImages, "products"));
        }
        log.info("Product update {} imageUrls before save: {}", productId, product.getImageUrls());

        return toResponse(productRepository.save(product));
    }

    @CacheEvict(value = {"products", "product"}, allEntries = true)
    public void delete(String productId, String vendorId) {
        Product product = findByIdAndVendor(productId, vendorId);
        product.setActive(false);
        productRepository.save(product);
        // FIX §3.3: decrement the atomic counter to mirror the create() increment.
        mongoTemplate.updateFirst(
                Query.query(Criteria.where("_id").is(vendorId)),
                new Update().inc("activeProductCount", -1),
                Vendor.class);
    }

    @CacheEvict(value = {"products", "product"}, allEntries = true)
    public ProductResponse setFlashSale(String productId, String vendorId,
                                        ProductRequest.FlashSaleRequest req) {
        Product product = findByIdAndVendor(productId, vendorId);
        FlashSale fs = FlashSale.builder()
                .salePrice(req.getSalePrice())
                .startTime(req.getStartTime())
                .endTime(req.getEndTime())
                .build();
        product.setFlashSale(fs);
        return toResponse(productRepository.save(product));
    }

    @CacheEvict(value = {"products", "product"}, allEntries = true)
    public ProductResponse removeFlashSale(String productId, String vendorId) {
        Product product = findByIdAndVendor(productId, vendorId);
        product.setFlashSale(null);
        return toResponse(productRepository.save(product));
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    public Product findActiveById(String id) {
        return productRepository.findById(id)
                .filter(Product::isActive)
                .orElseThrow(() -> new ResourceNotFoundException("Product", id));
    }

    private Product findByIdAndVendor(String id, String vendorId) {
        Product p = productRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Product", id));
        if (!p.getVendorId().equals(vendorId))
            throw new UnauthorizedException("You don't own this product");
        return p;
    }

    /** FIX §3.2: Enforce APPROVED status on mutating product operations. */
    private void requireApprovedVendor(String vendorId) {
        Vendor vendor = vendorRepository.findById(vendorId)
                .orElseThrow(() -> new ResourceNotFoundException("Vendor", vendorId));
        if (vendor.getStatus() != VendorStatus.APPROVED)
            throw new UnauthorizedException("Your vendor account is not approved to manage products");
    }

    private List<String> uploadImages(List<MultipartFile> files, String folder) {
        List<String> urls = new ArrayList<>();
        if (files != null) {
            files.forEach(f -> {
                String url = cloudinaryUploader.upload(f, folder);
                if (url != null) urls.add(url);
            });
        }
        log.info("Cloudinary returned image URLs: {}", urls);
        return urls;
    }

    public void updateRating(String productId, double avg, long count) {
        mongoTemplate.updateFirst(
                Query.query(Criteria.where("_id").is(productId)),
                new Update()
                        .set("averageRating", avg)
                        .set("totalReviews", (int) count),
                Product.class
        );
    }

    public ProductResponse toResponse(Product p) {
        return ProductResponse.builder()
                .id(p.getId())
                .vendorId(p.getVendorId())
                .vendorName(p.getVendorName())
                .name(p.getName())
                .description(p.getDescription())
                .category(p.getCategory())
                .subcategory(p.getSubcategory())
                .brand(p.getBrand())
                .sku(p.getSku())
                .tags(p.getTags())
                .imageUrls(p.getImageUrls())
                .price(p.getPrice())
                .discountedPrice(p.getDiscountedPrice())
                .effectivePrice(p.getEffectivePrice())
                .stock(p.getStock())
                .averageRating(p.getAverageRating())
                .totalReviews(p.getTotalReviews())
                .isActive(p.isActive())
                .isFeatured(p.isFeatured())
                .flashSale(p.getFlashSale())
                .specifications(p.getSpecifications())
                .createdAt(p.getCreatedAt())
                .updatedAt(p.getUpdatedAt())
                .build();
    }
}
