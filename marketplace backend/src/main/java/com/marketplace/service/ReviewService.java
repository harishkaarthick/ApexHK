package com.marketplace.service;

import com.marketplace.dto.request.ReviewRequest;
import com.marketplace.dto.response.*;
import com.marketplace.enums.OrderStatus;
import com.marketplace.exception.*;
import com.marketplace.model.Order;
import com.marketplace.model.OrderItem;
import com.marketplace.model.Review;
import com.marketplace.model.VendorOrder;
import com.marketplace.repository.*;
import com.marketplace.util.CloudinaryUploader;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.*;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.aggregation.*;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class ReviewService {

    private final ReviewRepository reviewRepository;
    private final OrderRepository orderRepository;
    private final ProductService productService;
    private final MongoTemplate mongoTemplate;
    private final CloudinaryUploader cloudinaryUploader;

    private static final int MAX_REVIEW_IMAGES = 5;

    public ReviewResponse create(String customerId, String customerName, ReviewRequest.Create req,
                                  List<MultipartFile> images) {
        if (reviewRepository.existsByCustomerIdAndProductId(customerId, req.getProductId()))
            throw new IllegalStateException("You have already reviewed this product");

        Order order = orderRepository.findById(req.getOrderId())
                .orElseThrow(() -> new ResourceNotFoundException("Order", req.getOrderId()));

        if (!order.getCustomerId().equals(customerId))
            throw new UnauthorizedException("Not your order");

        OrderItem orderItem = order.getItems().stream()
                .filter(oi -> req.getProductId().equals(oi.getProductId()))
                .findFirst()
                .orElseThrow(() -> new UnauthorizedException(
                        "You can only review products from this order"));

        OrderStatus itemStatus = resolveVendorOrder(order, orderItem)
                .map(VendorOrder::getStatus)
                .orElse(order.getStatus());

        if (itemStatus != OrderStatus.DELIVERED)
            throw new UnauthorizedException(
                    "You can only review products you have purchased and received");

        if (images != null && images.size() > MAX_REVIEW_IMAGES)
            throw new BadRequestException("You can attach at most " + MAX_REVIEW_IMAGES + " images");

        Review review = reviewRepository.save(Review.builder()
                .productId(req.getProductId())
                .customerId(customerId)
                .customerName(customerName)
                .orderId(req.getOrderId())
                .rating(req.getRating())
                .title(req.getTitle())
                .comment(req.getComment())
                .imageUrls(uploadImages(images))
                .build());

        recalculateRating(req.getProductId());
        return toResponse(review);
    }

    private List<String> uploadImages(List<MultipartFile> files) {
        List<String> urls = new ArrayList<>();
        if (files != null) {
            files.forEach(f -> {
                String url = cloudinaryUploader.upload(f, "reviews");
                if (url != null) urls.add(url);
            });
        }
        return urls;
    }

    public PagedResponse<ReviewResponse> getByProduct(String productId, Pageable pageable) {
        return PagedResponse.of(
                reviewRepository.findByProductIdAndIsHiddenFalse(productId, pageable)
                        .map(this::toResponse));
    }

    public java.util.Set<String> getMyReviewedProductIds(String customerId, List<String> productIds) {
        if (productIds == null || productIds.isEmpty()) return java.util.Set.of();
        return reviewRepository.findByCustomerIdAndProductIdIn(customerId, productIds).stream()
                .map(Review::getProductId)
                .collect(java.util.stream.Collectors.toSet());
    }

    public void delete(String reviewId, String customerId) {
        Review review = reviewRepository.findById(reviewId)
                .orElseThrow(() -> new ResourceNotFoundException("Review", reviewId));
        if (!review.getCustomerId().equals(customerId))
            throw new UnauthorizedException("Not your review");
        reviewRepository.delete(review);
        recalculateRating(review.getProductId());
    }

    private void recalculateRating(String productId) {
        Aggregation agg = Aggregation.newAggregation(
                Aggregation.match(Criteria.where("productId").is(productId)
                        .and("isHidden").is(false)),
                Aggregation.group()
                        .avg("rating").as("avg")
                        .count().as("count")
        );

        var results = mongoTemplate.aggregate(agg, "reviews", RatingStats.class);
        RatingStats stats = results.getUniqueMappedResult();

        double avg = stats != null ? stats.avg() : 0.0;
        long count = stats != null ? stats.count() : 0L;

        productService.updateRating(productId, avg, count);
    }

    private record RatingStats(double avg, long count) {}

    private Optional<VendorOrder> resolveVendorOrder(Order order, OrderItem item) {
        if (order.getVendorOrders() == null || order.getVendorOrders().isEmpty()
                || item.getVendorId() == null) {
            return Optional.empty();
        }
        return order.getVendorOrders().stream()
                .filter(vo -> item.getVendorId().equals(vo.getVendorId()))
                .findFirst();
    }

    public ReviewResponse toResponse(Review r) {
        return ReviewResponse.builder()
                .id(r.getId())
                .productId(r.getProductId())
                .customerId(r.getCustomerId())
                .customerName(r.getCustomerName())
                .orderId(r.getOrderId())
                .rating(r.getRating())
                .title(r.getTitle())
                .comment(r.getComment())
                .isApproved(r.isApproved())
                .isHidden(r.isHidden())
                .createdAt(r.getCreatedAt())
                .imageUrls(r.getImageUrls())
                .build();
    }
}
