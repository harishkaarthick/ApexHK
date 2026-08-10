package com.marketplace.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.marketplace.dto.request.ReturnRequestDto;
import com.marketplace.dto.response.ApiResponse;
import com.marketplace.security.SecurityUtil;
import com.marketplace.service.ReturnService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/returns")
@RequiredArgsConstructor
@Validated
@Tag(name = "Returns")
public class ReturnController {

    private final ReturnService returnService;
    private final ObjectMapper objectMapper;

    // Customer APIs

    // Accepts multipart/form-data so customers can attach evidence photos:
    // - "data": the ReturnRequestDto.Create payload, JSON-encoded
    // - "evidenceImages": up to 5 optional image files, uploaded to Cloudinary
    @PostMapping(consumes = "multipart/form-data")
    public ResponseEntity<?> create(@RequestParam("data") String dataJson,
                                    @RequestParam(value = "evidenceImages", required = false) List<MultipartFile> evidenceImages) {
        ReturnRequestDto.Create req = parseAndValidate(dataJson, ReturnRequestDto.Create.class);
        return ApiResponse.created("Return request submitted",
                returnService.create(SecurityUtil.currentUserId(), req, evidenceImages));
    }

    // Plain-JSON variant retained for API clients that already host their own evidence image URLs.
    @PostMapping(consumes = "application/json")
    public ResponseEntity<?> createJson(@Valid @RequestBody ReturnRequestDto.Create req) {
        return ApiResponse.created("Return request submitted",
                returnService.create(SecurityUtil.currentUserId(), req));
    }

    @GetMapping("/my-returns")
    public ResponseEntity<?> myReturns(@RequestParam(defaultValue = "0") int page,
                                       @RequestParam(defaultValue = "10") int size) {
        return ApiResponse.ok(returnService.getMyReturns(SecurityUtil.currentUserId(), PageRequest.of(page, size)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getById(@PathVariable String id) {
        return ApiResponse.ok(returnService.getById(id));
    }

    @PutMapping("/{id}/appeal")
    public ResponseEntity<?> appeal(@PathVariable String id,
                                    @Valid @RequestBody ReturnRequestDto.Appeal req) {
        return ApiResponse.ok("Appeal submitted successfully",
                returnService.customerAppeal(id, SecurityUtil.currentUserId(), req));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────
    // NOTE (Issue 5): The former admin-only endpoints that lived here
    //   GET  /api/returns/admin/all
    //   PUT  /api/returns/{id}/admin/resolve
    //   GET  /api/returns/analytics
    // have been removed. AdminController already exposes richer equivalents:
    //   GET  /api/admin/returns          (supports status filter + pagination)
    //   PUT  /api/admin/returns/{id}/appeal/resolve
    //   GET  /api/admin/returns/analytics
    // Keeping duplicates here caused clients to call weaker routes. Vendor return
    // operations are handled by VendorController under /api/vendor/returns so the
    // authenticated User ID is always resolved to the correct Vendor document ID.

    private <T> T parseAndValidate(String json, Class<T> type) {
        try {
            return objectMapper.readValue(json, type);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Invalid request data: " + e.getMessage());
        }
    }
}
