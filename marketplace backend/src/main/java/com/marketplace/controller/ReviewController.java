package com.marketplace.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.marketplace.dto.request.ReviewRequest;
import com.marketplace.dto.response.ApiResponse;
import com.marketplace.security.SecurityUtil;
import com.marketplace.service.ReviewService;
import com.marketplace.service.UserService;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/reviews")
@RequiredArgsConstructor
@Tag(name = "Reviews")
public class ReviewController {

    private final ReviewService reviewService;
    private final UserService   userService;
    private final ObjectMapper  objectMapper;

    @GetMapping("/product/{productId}")
    public ResponseEntity<?> getByProduct(@PathVariable String productId,
                                          @RequestParam(defaultValue = "0") int page,
                                          @RequestParam(defaultValue = "10") int size) {
        return ApiResponse.ok(reviewService.getByProduct(productId,
                PageRequest.of(page, size, Sort.by("createdAt").descending())));
    }

    @GetMapping("/mine/reviewed")
    public ResponseEntity<?> getMyReviewedProductIds(@RequestParam List<String> productIds) {
        return ApiResponse.ok(
                reviewService.getMyReviewedProductIds(SecurityUtil.currentUserId(), productIds));
    }

    @PostMapping(consumes = "multipart/form-data")
    public ResponseEntity<?> create(@RequestParam("data") String dataJson,
                                    @RequestParam(value = "images", required = false) List<MultipartFile> images) {
        ReviewRequest.Create req = parseAndValidate(dataJson, ReviewRequest.Create.class);
        String userId = SecurityUtil.currentUserId();
        // L-8: Use lightweight name projection — avoids loading the full User
        // document (including password hash) just to obtain the display name.
        String userName = userService.getUserName(userId);
        return ApiResponse.created("Review posted",
                reviewService.create(userId, userName, req, images));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable String id) {
        reviewService.delete(id, SecurityUtil.currentUserId());
        return ApiResponse.noContent("Review deleted");
    }

    private <T> T parseAndValidate(String json, Class<T> type) {
        try {
            return objectMapper.readValue(json, type);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Invalid request data: " + e.getMessage());
        }
    }
}