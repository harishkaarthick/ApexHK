package com.marketplace.controller;

import com.marketplace.dto.response.ApiResponse;
import com.marketplace.enums.BannerPlacement;
import com.marketplace.service.PublicService;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/public")
@RequiredArgsConstructor
@Tag(name = "Public")
public class PublicController {

    private final PublicService publicService;

    @GetMapping("/banners")
    public ResponseEntity<?> banners(@RequestParam(required = false) BannerPlacement placement) {
        return ApiResponse.ok(placement != null
                ? publicService.getActiveBanners(placement)
                : publicService.getActiveBanners());
    }

    @GetMapping("/coupons/active")
    public ResponseEntity<?> activeCoupons(
            // FIX H-2: Pageable.unpaged() loaded every active coupon in a single
            // MongoDB query. On a live store with hundreds of coupons this caused
            // OOM / slow responses.  A sensible default page size is applied here;
            // callers can pass ?page=N&size=N to navigate.
            @RequestParam(defaultValue = "0")  int page,
            @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.ok(
                publicService.getActiveCoupons(PageRequest.of(page, size)));
    }
}