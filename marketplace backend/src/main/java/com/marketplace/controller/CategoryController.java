package com.marketplace.controller;

import com.marketplace.dto.request.CategoryRequest;
import com.marketplace.dto.response.ApiResponse;
import com.marketplace.enums.CategoryStatus;
import com.marketplace.security.SecurityUtil;
import com.marketplace.service.CategoryService;
import com.marketplace.service.VendorService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
@Tag(name = "Categories")
public class CategoryController {

    private final CategoryService categoryService;
    private final VendorService vendorService;

    @GetMapping("/categories")
    public ResponseEntity<?> activeCategories() {
        return ApiResponse.ok(categoryService.getActiveCategories());
    }

    @PostMapping("/categories/request")
    @PreAuthorize("hasRole('VENDOR')")
    public ResponseEntity<?> requestCategory(@Valid @RequestBody CategoryRequest.Create req) {
        var vendor = vendorService.findByUserId(SecurityUtil.currentUserId());
        return ApiResponse.created("Category request submitted for admin approval.",
                categoryService.requestCategory(req.getName(), vendor.getId()));
    }

    @GetMapping("/admin/categories")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> adminCategories(@RequestParam(required = false) CategoryStatus status) {
        if (status == null || status == CategoryStatus.PENDING) {
            return ApiResponse.ok(categoryService.getPendingCategories());
        }
        return ApiResponse.ok(categoryService.getActiveCategories());
    }

    @PutMapping("/admin/categories/{id}/approve")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> approve(@PathVariable String id) {
        return ApiResponse.ok("Category approved", categoryService.approveCategory(id));
    }

    @PutMapping("/admin/categories/{id}/reject")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> reject(@PathVariable String id) {
        categoryService.rejectCategory(id);
        return ApiResponse.noContent("Category rejected");
    }
}
