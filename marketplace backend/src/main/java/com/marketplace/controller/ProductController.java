package com.marketplace.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.marketplace.dto.request.ProductRequest;
import com.marketplace.dto.response.ApiResponse;
import com.marketplace.security.SecurityUtil;
import com.marketplace.service.ProductService;
import com.marketplace.service.VendorService;
import com.marketplace.util.PaginationUtils;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import java.util.List;
import java.util.Set;

@RestController
@RequestMapping("/api/products")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Products")
public class ProductController {

    private final ProductService productService;
    private final VendorService  vendorService;
    private final ObjectMapper   objectMapper;

    private static final Set<String> ALLOWED_SORT = Set.of("createdAt", "price", "averageRating");

    @GetMapping
    public ResponseEntity<?> list(@RequestParam(defaultValue = "0")  int page,
                                  @RequestParam(defaultValue = "20") int size,
                                  @RequestParam(defaultValue = "createdAt") String sort) {
        if (!ALLOWED_SORT.contains(sort)) sort = "createdAt";
        return ApiResponse.ok(productService.getAllActive(
                PaginationUtils.page(page, size, Sort.by(sort).descending())));
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> get(@PathVariable String id) {
        return ApiResponse.ok(productService.getById(id));
    }

    @GetMapping("/category/{category}")
    public ResponseEntity<?> byCategory(@PathVariable String category,
                                        @RequestParam(defaultValue = "0")  int page,
                                        @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.ok(productService.getByCategory(category, PaginationUtils.page(page, size)));
    }

    @GetMapping("/search")
    public ResponseEntity<?> search(@RequestParam(required = false) String keyword,
                                    @RequestParam(required = false) String q,
                                    @RequestParam(defaultValue = "0")  int page,
                                    @RequestParam(defaultValue = "20") int size,
                                    @RequestParam(required = false) String category,
                                    @RequestParam(required = false) String brand,
                                    @RequestParam(required = false) Double minPrice,
                                    @RequestParam(required = false) Double maxPrice,
                                    @RequestParam(required = false) Double minRating,
                                    @RequestParam(required = false) Boolean inStock,
                                    @RequestParam(defaultValue = "relevance") String sort) {
        String query = q != null ? q : (keyword == null ? "" : keyword);
        return ApiResponse.ok(productService.search(query, PaginationUtils.page(page, size),
                category, brand, minPrice, maxPrice, minRating, inStock, sort));
    }

    @GetMapping("/autocomplete")
    public ResponseEntity<?> autocomplete(@RequestParam(defaultValue = "") String q) {
        return ApiResponse.ok(productService.autocomplete(q));
    }

    @GetMapping("/featured")
    public ResponseEntity<?> featured() {
        return ApiResponse.ok(productService.getFeatured());
    }

    @PostMapping(consumes = "multipart/form-data")
    public ResponseEntity<?> create(@RequestParam("data") String dataJson,
                                    @RequestParam(value = "images", required = false) List<MultipartFile> images) {
        logImageRequest("create", images);
        ProductRequest.Create req = parseAndValidate(dataJson, ProductRequest.Create.class);
        var vendor = vendorService.findByUserId(SecurityUtil.currentUserId());
        return ApiResponse.created("Product created",
                productService.create(vendor.getId(), vendor.getStoreName(), req, images));
    }

    @PutMapping(value = "/{id}", consumes = "multipart/form-data")
    public ResponseEntity<?> update(@PathVariable String id,
                                    @RequestParam("data") String dataJson,
                                    @RequestParam(value = "images", required = false) List<MultipartFile> images) {
        logImageRequest("update " + id, images);
        ProductRequest.Update req = parseAndValidate(dataJson, ProductRequest.Update.class);
        var vendor = vendorService.findByUserId(SecurityUtil.currentUserId());
        return ApiResponse.ok("Product updated",
                productService.update(id, vendor.getId(), req, images));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable String id) {
        var vendor = vendorService.findByUserId(SecurityUtil.currentUserId());
        productService.delete(id, vendor.getId());
        return ApiResponse.noContent("Product deleted");
    }

    @PostMapping("/{id}/flash-sale")
    public ResponseEntity<?> setFlashSale(@PathVariable String id,
                                          @Valid @RequestBody ProductRequest.FlashSaleRequest req) {
        var vendor = vendorService.findByUserId(SecurityUtil.currentUserId());
        return ApiResponse.ok("Flash sale set", productService.setFlashSale(id, vendor.getId(), req));
    }

    @DeleteMapping("/{id}/flash-sale")
    public ResponseEntity<?> removeFlashSale(@PathVariable String id) {
        var vendor = vendorService.findByUserId(SecurityUtil.currentUserId());
        return ApiResponse.ok("Flash sale removed", productService.removeFlashSale(id, vendor.getId()));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private <T> T parseAndValidate(String json, Class<T> type) {
        try {
            return objectMapper.readValue(json, type);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Invalid request data: " + e.getMessage());
        }
    }

    private void logImageRequest(String action, List<MultipartFile> images) {
        int count = images == null ? 0 : images.size();
        List<String> names = images == null
                ? List.of()
                : images.stream().map(MultipartFile::getOriginalFilename).toList();
        log.info("Product {} received {} image file(s): {}", action, count, names);
    }
}
