package com.marketplace.controller;

import com.marketplace.dto.request.CartRequest;
import com.marketplace.dto.response.ApiResponse;
import com.marketplace.security.SecurityUtil;
import com.marketplace.service.CartService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/cart")
@RequiredArgsConstructor
@Tag(name = "Cart")
public class CartController {

    private final CartService cartService;

    @GetMapping
    public ResponseEntity<?> get() {
        return ApiResponse.ok(cartService.getCart(SecurityUtil.currentUserId()));
    }

    @PostMapping("/items")
    public ResponseEntity<?> add(@Valid @RequestBody CartRequest.AddItem req) {
        return ApiResponse.ok("Item added", cartService.addItem(SecurityUtil.currentUserId(), req));
    }

    @PutMapping("/items")
    public ResponseEntity<?> update(@Valid @RequestBody CartRequest.UpdateItem req) {
        return ApiResponse.ok("Cart updated", cartService.updateItem(SecurityUtil.currentUserId(), req));
    }

    @DeleteMapping("/items/{productId}")
    public ResponseEntity<?> remove(@PathVariable String productId) {
        return ApiResponse.ok("Item removed", cartService.removeItem(SecurityUtil.currentUserId(), productId));
    }

    @DeleteMapping
    public ResponseEntity<?> clear() {
        cartService.clearCart(SecurityUtil.currentUserId());
        return ApiResponse.noContent("Cart cleared");
    }
}


