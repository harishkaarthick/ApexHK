
package com.marketplace.service;

import com.marketplace.dto.request.CartRequest;
import com.marketplace.dto.response.CartResponse;
import com.marketplace.exception.ResourceNotFoundException;
import com.marketplace.model.*;
import com.marketplace.repository.CartRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;


import java.util.ArrayList;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class CartService {

    private final CartRepository cartRepository;
    private final ProductService productService;

    public CartResponse getCart(String userId) {
        return toResponse(getOrCreate(userId));
    }

    /**
     * FIX 3c: The previous stock check only compared available stock against
     * the incoming delta quantity, ignoring whatever quantity was already in
     * the cart for this product:
     *
     *   if (product.getStock() < req.getQuantity())   // delta only
     *       throw new IllegalStateException("Insufficient stock");
     *
     * Example: stock = 5, cart already holds 4 of this product, user adds 2.
     * Old check: 5 < 2 → false → no error.  Cart ends up with 6 items against
     * stock of 5 — an invalid state.  Checkout catches this eventually, but the
     * cart itself becomes inconsistent.
     *
     * Fix: fetch the cart first (single DB call, reused below), sum the quantity
     * already there, and validate the combined total against available stock.
     */
    public CartResponse addItem(String userId, CartRequest.AddItem req) {
        Product product = productService.findActiveById(req.getProductId());

        // Fetch cart first so we can include its current quantity in the check.
        Cart cart = getOrCreate(userId);

        int alreadyInCart = cart.getItems().stream()
                .filter(i -> i.getProductId().equals(req.getProductId()))
                .mapToInt(CartItem::getQuantity)
                .sum();

        if (product.getStock() < alreadyInCart + req.getQuantity())
            throw new IllegalStateException(
                    "Insufficient stock. Available: " + product.getStock()
                            + ", already in cart: " + alreadyInCart
                            + ", requested: " + req.getQuantity());

        Optional<CartItem> existing = cart.getItems().stream()
                .filter(i -> i.getProductId().equals(req.getProductId()))
                .findFirst();

        if (existing.isPresent()) {
            existing.get().setQuantity(existing.get().getQuantity() + req.getQuantity());
        } else {
            CartItem item = CartItem.builder()
                    .productId(product.getId())
                    .productName(product.getName())
                    .vendorId(product.getVendorId())
                    .imageUrl(product.getImageUrls().isEmpty()
                            ? null : product.getImageUrls().get(0))
                    .quantity(req.getQuantity())
                    .unitPrice(product.getEffectivePrice())
                    .build();
            cart.getItems().add(item);
        }

        return toResponse(cartRepository.save(cart));
    }

    /**
     * FIX C-6: updateItem had no stock validation at all.
     *
     * A client could call PUT /api/cart/items with quantity=10000 for a product
     * with stock=1 and the cart would be saved with that quantity unchecked.
     * addItem correctly validates stock; updateItem must do the same.
     *
     * Unlike addItem (which adds a delta), updateItem replaces the quantity
     * absolutely, so we validate req.getQuantity() directly against available
     * stock — there is no "already in cart" component to add.
     */
    public CartResponse updateItem(String userId, CartRequest.UpdateItem req) {
        // Validate stock before touching the cart
        Product product = productService.findActiveById(req.getProductId());
        if (product.getStock() < req.getQuantity())
            throw new IllegalStateException(
                    "Insufficient stock. Available: " + product.getStock()
                            + ", requested: " + req.getQuantity());

        Cart cart = getOrCreate(userId);
        cart.getItems().stream()
                .filter(i -> i.getProductId().equals(req.getProductId()))
                .findFirst()
                .ifPresent(i -> i.setQuantity(req.getQuantity()));
        return toResponse(cartRepository.save(cart));
    }

    public CartResponse removeItem(String userId, String productId) {
        Cart cart = getOrCreate(userId);
        cart.getItems().removeIf(i -> i.getProductId().equals(productId));
        return toResponse(cartRepository.save(cart));
    }

    public void clearCart(String userId) {
        cartRepository.findByUserId(userId).ifPresent(cart -> {
            cart.setItems(new ArrayList<>());
            cartRepository.save(cart);
        });
    }

    private Cart getOrCreate(String userId) {
        return cartRepository.findByUserId(userId)
                .orElseGet(() -> cartRepository.save(
                        Cart.builder().userId(userId).build()));
    }

    private CartResponse toResponse(Cart cart) {
        return CartResponse.builder()
                .id(cart.getId())
                .userId(cart.getUserId())
                .items(cart.getItems())
                .totalAmount(cart.getTotalAmount())
                .itemCount(cart.getItems().size())
                .build();
    }
}
