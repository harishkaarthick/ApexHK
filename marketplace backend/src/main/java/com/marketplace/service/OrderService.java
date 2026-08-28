package com.marketplace.service;

import com.marketplace.dto.request.OrderRequest;
import com.marketplace.dto.response.DeliveryOtpResponse;
import com.marketplace.dto.response.OrderResponse;
import com.marketplace.dto.response.PagedResponse;
import com.marketplace.enums.OrderStatus;
import com.marketplace.exception.PaymentException;
import com.marketplace.exception.ResourceNotFoundException;
import com.marketplace.exception.UnauthorizedException;
import com.marketplace.model.Address;
import com.marketplace.model.Cart;
import com.marketplace.model.CartItem;
import com.marketplace.model.Coupon;
import com.marketplace.model.Order;
import com.marketplace.model.OrderItem;
import com.marketplace.model.VendorOrder;
import com.marketplace.model.Product;
import com.marketplace.model.User;
import com.marketplace.model.Vendor;
import com.marketplace.repository.CartRepository;
import com.marketplace.repository.CouponRepository;
import com.marketplace.repository.OrderRepository;
import com.marketplace.repository.ProductRepository;
import com.marketplace.repository.UserRepository;
import com.marketplace.repository.VendorRepository;
import com.marketplace.util.RazorpayUtil;
import com.razorpay.RazorpayClient;
import com.razorpay.RazorpayException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

@Slf4j
@Service
@RequiredArgsConstructor
public class OrderService {

    private final OrderRepository     orderRepository;
    private final CartRepository      cartRepository;
    private final ProductRepository   productRepository;
    private final CouponRepository    couponRepository;
    private final VendorRepository    vendorRepository;
    private final UserRepository      userRepository;
    private final WalletService       walletService;
    private final NotificationService notificationService;
    private final EmailService        emailService;
    private final RazorpayClient      razorpayClient;
    private final MongoTemplate       mongoTemplate;
    private final RazorpayUtil        razorpayUtil;

    @Value("${razorpay.key-id}") private String razorpayKeyId;

    private static final SecureRandom OTP_RANDOM = new SecureRandom();
    private static final int DELIVERY_OTP_EXPIRY_HOURS = 24;

    // FIX 3: allowed vendor status transitions
    private static final Map<OrderStatus, Set<OrderStatus>> VENDOR_TRANSITIONS = Map.of(
            OrderStatus.PENDING,     Set.of(OrderStatus.CONFIRMED),
            OrderStatus.CONFIRMED,   Set.of(OrderStatus.PROCESSING),
            OrderStatus.PROCESSING,  Set.of(OrderStatus.SHIPPED),
            OrderStatus.SHIPPED,     Set.of(OrderStatus.OUT_FOR_DELIVERY)
    );

    // Status display order for UI
    public static final List<OrderStatus> STATUS_ORDER = List.of(
            OrderStatus.PENDING,
            OrderStatus.CONFIRMED,
            OrderStatus.PROCESSING,
            OrderStatus.SHIPPED,
            OrderStatus.OUT_FOR_DELIVERY,
            OrderStatus.DELIVERED,
            OrderStatus.CANCELLED,
            OrderStatus.REFUNDED
    );

    public Map<String, Object> checkout(String customerId, String customerName,
                                        OrderRequest.Checkout req) {
        Cart cart = cartRepository.findByUserId(customerId)
                .filter(c -> !c.getItems().isEmpty())
                .orElseThrow(() -> new IllegalStateException("Cart is empty"));

        User user = userRepository.findById(customerId)
                .orElseThrow(() -> new ResourceNotFoundException("User", customerId));

        Address shipping = user.getAddresses().stream()
                .filter(a -> a.getId().equals(req.getAddressId()))
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("Address", req.getAddressId()));

        // Build items + validate stock (read-only check before atomic deduct)
        List<OrderItem> orderItems = new ArrayList<>();
        double total = 0;
        for (CartItem ci : cart.getItems()) {
            Product p = productRepository.findById(ci.getProductId())
                    .orElseThrow(() -> new ResourceNotFoundException("Product", ci.getProductId()));
            if (p.getStock() < ci.getQuantity())
                throw new IllegalStateException("Insufficient stock for: " + p.getName());
            double unit = p.getEffectivePrice();
            orderItems.add(OrderItem.builder()
                    .id(UUID.randomUUID().toString())
                    .productId(p.getId())
                    .productName(p.getName())
                    .vendorId(p.getVendorId())
                    .vendorName(p.getVendorName())
                    .imageUrl(p.getImageUrls().isEmpty() ? null : p.getImageUrls().get(0))
                    .quantity(ci.getQuantity())
                    .unitPrice(unit)
                    .totalPrice(unit * ci.getQuantity())
                    .build());
            total += unit * ci.getQuantity();
        }

        // Coupon
        double discount = 0;
        String couponCode = req.getCouponCode();
        if (couponCode != null && !couponCode.isBlank())
            discount = applyCoupon(couponCode, customerId, total);

        // Wallet
        double walletUsed = 0;
        if (req.getWalletAmountToUse() > 0) {
            double maxWallet = Math.min(walletService.getBalance(customerId), total - discount);
            walletUsed = Math.min(req.getWalletAmountToUse(), maxWallet);
        }

        double razorpayAmount = Math.max(0, total - discount - walletUsed);

        // Split items into one VendorOrder per distinct vendor. This is the
        // isolation boundary: each VendorOrder only ever contains that vendor's
        // items and only that vendor's fulfillment state.
        List<VendorOrder> vendorOrders = buildVendorOrders(orderItems);

        // Persist order
        Order order = orderRepository.save(Order.builder()
                .customerId(customerId)
                .customerName(customerName)
                .items(orderItems)
                .vendorOrders(vendorOrders)
                .shippingAddress(shipping)
                .totalAmount(total)
                .discountAmount(discount)
                .walletAmountUsed(walletUsed)
                .razorpayAmount(razorpayAmount)
                .couponCode(req.getCouponCode())
                .status(OrderStatus.PENDING)
                .build());

        // parentOrderId is only known once Mongo assigns the order's _id on save.
        // (order itself is reassigned below, so it can't be captured by the lambda directly.)
        for (VendorOrder vo : order.getVendorOrders()) {
            vo.setParentOrderId(order.getId());
        }
        order = orderRepository.save(order);

        // Atomic stock deduction — $inc only if stock >= quantity.
        // Track every item successfully decremented so we can roll back on partial failure.
        List<CartItem> decremented = new ArrayList<>();
        for (CartItem ci : cart.getItems()) {
            Query q = Query.query(
                    Criteria.where("_id").is(ci.getProductId())
                            .and("stock").gte(ci.getQuantity())
            );
            Update u = new Update().inc("stock", -ci.getQuantity());
            var result = mongoTemplate.findAndModify(q, u, Product.class);
            if (result == null) {
                // Another request beat us — roll back the order, the coupon,
                // AND every stock decrement that already succeeded.
                orderRepository.delete(order);
                rollbackCoupon(couponCode, customerId);
                decremented.forEach(done ->
                        mongoTemplate.updateFirst(
                                Query.query(Criteria.where("_id").is(done.getProductId())),
                                new Update().inc("stock", done.getQuantity()),
                                Product.class
                        ));
                throw new IllegalStateException(
                        "Stock was taken by another order. Please try again.");
            }
            decremented.add(ci);
        }

        // Deduct wallet
        if (walletUsed > 0) {
            try {
                walletService.debit(customerId, walletUsed, "Order payment", order.getId());
            } catch (Exception walletEx) {
                // Full rollback: delete order, restore all stock, rollback coupon
                orderRepository.delete(order);
                rollbackCoupon(couponCode, customerId);
                decremented.forEach(done ->
                        mongoTemplate.updateFirst(
                                Query.query(Criteria.where("_id").is(done.getProductId())),
                                new Update().inc("stock", done.getQuantity()),
                                Product.class
                        ));
                throw new IllegalStateException(
                        "Wallet payment failed: " + walletEx.getMessage(), walletEx);
            }
        }

        // Razorpay order
        String rzpOrderId = null;
        if (razorpayAmount > 0) {
            try {
                JSONObject opts = new JSONObject();
                opts.put("amount",   (int) (razorpayAmount * 100));
                opts.put("currency", "INR");
                opts.put("receipt",  order.getId());
                com.razorpay.Order rzpOrder = razorpayClient.orders.create(opts);
                rzpOrderId = rzpOrder.get("id");
                order.setRazorpayOrderId(rzpOrderId);
                orderRepository.save(order);
            } catch (RazorpayException e) {
                // Full rollback: delete order, restore stock, refund wallet, rollback coupon
                orderRepository.delete(order);
                cart.getItems().forEach(ci ->
                        mongoTemplate.updateFirst(
                                Query.query(Criteria.where("_id").is(ci.getProductId())),
                                new Update().inc("stock", ci.getQuantity()),
                                Product.class
                        ));
                if (walletUsed > 0)
                    walletService.credit(customerId, walletUsed,
                            "Refund: payment order creation failed", null);
                rollbackCoupon(couponCode, customerId);
                throw new PaymentException("Failed to create payment order: " + e.getMessage(), e);
            }
        } else {
            confirmAllVendorOrders(order);
            orderRepository.save(order);
            postOrderSuccess(order);
        }

        return Map.of(
                "orderId",         order.getId(),
                "razorpayOrderId", rzpOrderId != null ? rzpOrderId : "",
                "amount",          (long) (razorpayAmount * 100),
                "currency",        "INR",
                "key",             razorpayKeyId.trim()
        );
    }

    // FIXED critical-1 (auth) + critical-4 (double-credit guard):
    public OrderResponse verifyAndConfirm(String customerId, OrderRequest.VerifyPayment req) {
        Order order = orderRepository.findByRazorpayOrderId(req.getRazorpayOrderId())
                .orElseThrow(() -> new ResourceNotFoundException("Order not found for payment"));

        if (!order.getCustomerId().equals(customerId))
            throw new UnauthorizedException("Not your order");

        if (order.getStatus() == OrderStatus.CONFIRMED) {
            log.info("verifyAndConfirm: order {} already confirmed, skipping", order.getId());
            return toResponse(order);
        }

        if (order.getStatus() != OrderStatus.PENDING)
            throw new IllegalStateException(
                    "Order is in status " + order.getStatus() + " and cannot be confirmed");

        if (!verifySignature(req.getRazorpayOrderId(),
                req.getRazorpayPaymentId(), req.getRazorpaySignature())) {
            // Payment failed verification — release the coupon/stock/wallet hold
            // immediately instead of leaving the order PENDING for the scheduled
            // stale-order sweep (which can take up to cleanup-interval-ms to run).
            failOrder(order);
            throw new PaymentException("Payment signature verification failed");
        }

        order.setPaymentId(req.getRazorpayPaymentId());
        confirmAllVendorOrders(order);
        order = orderRepository.save(order);
        postOrderSuccess(order);
        return toResponse(order);
    }

    public PagedResponse<OrderResponse> getMyOrders(String customerId, Pageable pageable) {
        return PagedResponse.of(
                orderRepository.findByCustomerIdOrderByPlacedAtDesc(customerId, pageable)
                        .map(this::toResponse));
    }

    // BUG FIX 2: was ignoring all filter params; now builds a dynamic MongoDB query
    // so search, status, and date-range filters actually work server-side.
    public PagedResponse<OrderResponse> getVendorOrders(
            String vendorId, Pageable pageable,
            String searchOrderId, String searchCustomerName,
            String searchProductName, String status,
            String startDate, String endDate) {

        // NOTE: criteria filters on vendorOrders.vendorId (not items.vendorId) so
        // that only orders containing a portion for THIS vendor are matched at all.
        // The vendor-scoping of the returned payload itself happens in
        // toVendorResponse(), which strips out every other vendor's items/status.
        Criteria criteria = Criteria.where("vendorOrders.vendorId").is(vendorId);

        if (searchOrderId != null && !searchOrderId.isBlank())
            criteria = criteria.and("_id")
                    .regex(java.util.regex.Pattern.compile(
                            java.util.regex.Pattern.quote(searchOrderId),
                            java.util.regex.Pattern.CASE_INSENSITIVE));

        if (searchCustomerName != null && !searchCustomerName.isBlank())
            criteria = criteria.and("customerName")
                    .regex(java.util.regex.Pattern.compile(
                            java.util.regex.Pattern.quote(searchCustomerName),
                            java.util.regex.Pattern.CASE_INSENSITIVE));

        if (searchProductName != null && !searchProductName.isBlank())
            criteria = criteria.and("vendorOrders")
                    .elemMatch(Criteria.where("vendorId").is(vendorId)
                            .and("items.productName")
                            .regex(java.util.regex.Pattern.compile(
                                    java.util.regex.Pattern.quote(searchProductName),
                                    java.util.regex.Pattern.CASE_INSENSITIVE)));

        // status filters on THIS vendor's portion status, not the aggregate parent status.
        if (status != null && !status.isBlank())
            criteria = criteria.and("vendorOrders")
                    .elemMatch(Criteria.where("vendorId").is(vendorId)
                            .and("status").is(OrderStatus.valueOf(status)));

        if (startDate != null && !startDate.isBlank())
            criteria = criteria.and("placedAt")
                    .gte(java.time.LocalDate.parse(startDate).atStartOfDay());

        if (endDate != null && !endDate.isBlank())
            criteria = criteria.and("placedAt")
                    .lte(java.time.LocalDate.parse(endDate).atTime(23, 59, 59));

        Query q = new Query(criteria).with(pageable);
        long total = mongoTemplate.count(new Query(criteria), Order.class);
        List<Order> orders = mongoTemplate.find(q, Order.class);

        org.springframework.data.domain.Page<Order> page =
                new org.springframework.data.domain.PageImpl<>(orders, pageable, total);
        return PagedResponse.of(page.map(o -> toVendorResponse(o, vendorId)));
    }

    // BUG FIX 1: New method for the /vendor/orders/stats endpoint that was missing.
    // Counts orders per status for this vendor and sums revenue/commission.
    public Map<String, Object> getVendorOrderStats(String vendorId) {
        // All stats are computed by loading this vendor's own VendorOrder entries
        // only — never from the parent Order's items/status, which span every vendor.
        List<Order> ordersForVendor = mongoTemplate.find(
                new Query(Criteria.where("vendorOrders.vendorId").is(vendorId)),
                Order.class);

        List<VendorOrder> myPortions = ordersForVendor.stream()
                .flatMap(o -> o.getVendorOrders().stream())
                .filter(vo -> vendorId.equals(vo.getVendorId()))
                .toList();

        long totalOrders      = myPortions.size();
        long pendingOrders    = myPortions.stream().filter(vo -> vo.getStatus() == OrderStatus.PENDING).count();
        long processingOrders = myPortions.stream().filter(vo -> vo.getStatus() == OrderStatus.PROCESSING).count();
        long shippedOrders    = myPortions.stream().filter(vo -> vo.getStatus() == OrderStatus.SHIPPED).count();
        long outForDelivery   = myPortions.stream().filter(vo -> vo.getStatus() == OrderStatus.OUT_FOR_DELIVERY).count();
        long deliveredOrders  = myPortions.stream().filter(vo -> vo.getStatus() == OrderStatus.DELIVERED).count();

        double totalRevenue = myPortions.stream()
                .filter(vo -> vo.getStatus() == OrderStatus.DELIVERED)
                .mapToDouble(VendorOrder::getSubtotal)
                .sum();
        double platformCommission = myPortions.stream()
                .filter(vo -> vo.getStatus() == OrderStatus.DELIVERED)
                .mapToDouble(vo -> vo.getCommissionAmount() != null ? vo.getCommissionAmount() : 0)
                .sum();

        return Map.of(
                "totalOrders",        totalOrders,
                "pendingOrders",      pendingOrders,
                "processingOrders",   processingOrders,
                "shippedOrders",      shippedOrders,
                "outForDeliveryOrders", outForDelivery,
                "deliveredOrders",    deliveredOrders,
                "totalRevenue",       totalRevenue,
                "platformCommission", platformCommission
        );
    }

    public OrderResponse getOrder(String orderId, String userId) {
        Order order = findById(orderId);
        boolean isCustomer = order.getCustomerId().equals(userId);
        if (isCustomer) return toResponse(order);

        // Not the customer — check whether the caller is one of the vendors on
        // this order, and if so return ONLY that vendor's scoped portion.
        return vendorRepository.findByUserId(userId)
                .filter(v -> order.getVendorOrders().stream()
                        .anyMatch(vo -> v.getId().equals(vo.getVendorId())))
                .map(v -> toVendorResponse(order, v.getId()))
                .orElseThrow(() -> new UnauthorizedException("Access denied"));
    }

    public DeliveryOtpResponse getDeliveryOtp(String orderId, String customerId) {
        Order order = findById(orderId);
        if (!order.getCustomerId().equals(customerId)) {
            throw new UnauthorizedException("Not your order");
        }

        LocalDateTime now = LocalDateTime.now();
        List<DeliveryOtpResponse.Entry> activeOtps = order.getVendorOrders().stream()
                .filter(vo -> vo.getStatus() == OrderStatus.OUT_FOR_DELIVERY)
                .filter(vo -> !Boolean.TRUE.equals(vo.getOtpVerified()))
                .filter(vo -> vo.getDeliveryOtp() != null && vo.getOtpGeneratedAt() != null)
                .filter(vo -> !vo.getOtpGeneratedAt().plusHours(DELIVERY_OTP_EXPIRY_HOURS).isBefore(now))
                .map(vo -> DeliveryOtpResponse.Entry.builder()
                        .vendorId(vo.getVendorId())
                        .vendorName(vo.getVendorName())
                        .otp(vo.getDeliveryOtp())
                        .generatedAt(vo.getOtpGeneratedAt())
                        .expiresAt(vo.getOtpGeneratedAt().plusHours(DELIVERY_OTP_EXPIRY_HOURS))
                        .build())
                .toList();

        log.info("Customer {} requested delivery OTP for order {}: activeOtpCount={}",
                customerId, orderId, activeOtps.size());
        return DeliveryOtpResponse.builder()
                .orderId(order.getId())
                .otps(activeOtps)
                .build();
    }

    // FIX 3: enforce allowed vendor status transitions.
    // Mutates ONLY the calling vendor's VendorOrder sub-document, then recomputes
    // the parent (customer-facing) Order.status from every vendor's state.
    public OrderResponse updateStatus(String orderId, String vendorId,
                                      OrderRequest.UpdateStatus req) {
        Order order = findById(orderId);
        VendorOrder mine = findVendorOrderOrThrow(order, vendorId);

        Set<OrderStatus> allowed = VENDOR_TRANSITIONS.getOrDefault(mine.getStatus(), Set.of());
        if (!allowed.contains(req.getStatus()))
            throw new IllegalStateException(
                    "Cannot transition order from " + mine.getStatus() + " to " + req.getStatus());

        mine.setStatus(req.getStatus());
        if (req.getStatus() == OrderStatus.CONFIRMED) {
            mine.setConfirmedAt(LocalDateTime.now());
        }
        if (req.getStatus() == OrderStatus.SHIPPED) {
            mine.setShippedDate(LocalDateTime.now());
        }
        if (req.getStatus() == OrderStatus.DELIVERED) {
            mine.setDeliveredAt(LocalDateTime.now());
        }

        recomputeParentStatus(order);
        order = orderRepository.save(order);
        sendStatusNotifications(order, mine, req.getStatus(), null);
        return toVendorResponse(order, vendorId);
    }

    public OrderResponse addTracking(String orderId, String vendorId,
                                     OrderRequest.AddTracking req) {
        Order order = findById(orderId);
        VendorOrder mine = findVendorOrderOrThrow(order, vendorId);

        Set<OrderStatus> allowed = VENDOR_TRANSITIONS.getOrDefault(mine.getStatus(), Set.of());
        if (!allowed.contains(OrderStatus.SHIPPED))
            throw new IllegalStateException(
                    "Cannot ship order in status: " + mine.getStatus());

        mine.setTrackingId(req.getTrackingId());
        mine.setStatus(OrderStatus.SHIPPED);
        mine.setShippedDate(LocalDateTime.now());
        recomputeParentStatus(order);
        final Order savedOrder = orderRepository.save(order);

        notificationService.send(savedOrder.getCustomerId(), "Order Shipped",
                "Tracking ID: " + req.getTrackingId(), "ORDER_SHIPPED", savedOrder.getId());
        userRepository.findById(savedOrder.getCustomerId()).ifPresent(u ->
                emailService.sendOrderShipped(
                        u.getEmail(), u.getName(), savedOrder.getId(), req.getTrackingId()));
        return toVendorResponse(savedOrder, vendorId);
    }

    // OTP Generation and Verification — vendor-specific: each VendorOrder has
    // its own OTP, so Vendor A can never generate/verify one for Vendor B's items.
    public void generateOtp(String orderId, String vendorId) {
        Order order = findById(orderId);
        VendorOrder mine = findVendorOrderOrThrow(order, vendorId);

        if (mine.getStatus() != OrderStatus.OUT_FOR_DELIVERY) {
            throw new IllegalStateException("OTP can only be generated when order is OUT_FOR_DELIVERY");
        }

        ensureDeliveryOtp(order, mine);
        orderRepository.save(order);
    }

    public OrderResponse verifyOtp(String orderId, String userId, String otp, String targetVendorId) {
        Order order = findById(orderId);
        boolean isCustomer = order.getCustomerId().equals(userId);

        VendorOrder mine = null;
        // order is reassigned later in this method (after save()), so it can't be
        // captured directly inside the flatMap lambda below — alias it first.
        final Order orderForLookup = order;
        if (!isCustomer) {
            mine = vendorRepository.findByUserId(userId)
                    .flatMap(v -> orderForLookup.getVendorOrders().stream()
                            .filter(vo -> v.getId().equals(vo.getVendorId()))
                            .findFirst())
                    .orElseThrow(() -> new UnauthorizedException("Not your order"));
        } else if (targetVendorId != null && !targetVendorId.isBlank()) {
            mine = order.getVendorOrders().stream()
                    .filter(vo -> targetVendorId.equals(vo.getVendorId()))
                    .findFirst()
                    .orElse(null);
        } else {
            // Legacy/single-vendor fallback: match by OTP value when the caller
            // (older frontend build) didn't send which vendor portion this is for.
            mine = order.getVendorOrders().stream()
                    .filter(vo -> otp.equals(vo.getDeliveryOtp()))
                    .findFirst()
                    .orElse(null);
        }
        if (mine == null)
            throw new IllegalStateException("Invalid OTP");

        if (mine.getStatus() != OrderStatus.OUT_FOR_DELIVERY) {
            throw new IllegalStateException("OTP verification can only be done when order is OUT_FOR_DELIVERY");
        }
        if (mine.getDeliveryOtp() == null || mine.getOtpGeneratedAt() == null) {
            throw new IllegalStateException("Delivery OTP has not been generated");
        }
        if (mine.getOtpGeneratedAt().plusHours(DELIVERY_OTP_EXPIRY_HOURS).isBefore(LocalDateTime.now())) {
            throw new IllegalStateException("OTP has expired. Please request a new one.");
        }
        if (!otp.equals(mine.getDeliveryOtp())) {
            throw new IllegalStateException("Invalid OTP");
        }

        mine.setOtpVerified(true);
        mine.setDeliveryOtp(null);
        mine.setDeliveredAt(LocalDateTime.now());
        mine.setStatus(OrderStatus.DELIVERED);
        recomputeParentStatus(order);
        order = orderRepository.save(order);
        final Order deliveredOrder = order;
        updateOrderRevenue(deliveredOrder, mine.getVendorId());

        notificationService.send(deliveredOrder.getCustomerId(), "Order Delivered",
                "Your order has been delivered successfully.", "ORDER_DELIVERED", deliveredOrder.getId());
        userRepository.findById(deliveredOrder.getCustomerId()).ifPresent(u ->
                emailService.sendOrderDelivered(u.getEmail(), u.getName(), deliveredOrder.getId()));

        return isCustomer ? toResponse(deliveredOrder) : toVendorResponse(deliveredOrder, mine.getVendorId());
    }

    public OrderResponse updateShippingDetails(String orderId, String vendorId,
                                               OrderRequest.UpdateShippingDetails req) {
        Order order = findById(orderId);
        VendorOrder mine = findVendorOrderOrThrow(order, vendorId);

        if (mine.getStatus() != OrderStatus.SHIPPED) {
            throw new IllegalStateException("Shipping details can only be updated when order is SHIPPED");
        }

        mine.setCourierName(req.getCourierName());
        mine.setTrackingId(req.getTrackingNumber());
        mine.setShippedDate(LocalDateTime.now());
        mine.setStatus(OrderStatus.OUT_FOR_DELIVERY);
        ensureDeliveryOtp(order, mine);
        recomputeParentStatus(order);
        order = orderRepository.save(order);

        sendStatusNotifications(order, mine, OrderStatus.OUT_FOR_DELIVERY, req.getTrackingNumber());

        return toVendorResponse(order, vendorId);
    }

    // FIX H-3: cancellation window constants.
    private static final int CONFIRMED_CANCEL_WINDOW_HOURS = 1;

    // FIX 2: rollback coupon usage on cancel
    public OrderResponse cancelOrder(String orderId, String customerId) {
        Order order = findById(orderId);
        if (!order.getCustomerId().equals(customerId))
            throw new UnauthorizedException("Not your order");
        if (order.getStatus() != OrderStatus.PENDING
                && order.getStatus() != OrderStatus.CONFIRMED)
            throw new IllegalStateException("Order cannot be cancelled at this stage");

        if (order.getStatus() == OrderStatus.CONFIRMED && order.getConfirmedAt() != null) {
            LocalDateTime cutoff = order.getConfirmedAt()
                    .plusHours(CONFIRMED_CANCEL_WINDOW_HOURS);
            if (LocalDateTime.now().isAfter(cutoff))
                throw new IllegalStateException(
                        "Cancellation window has closed. Confirmed orders can only be cancelled "
                                + "within " + CONFIRMED_CANCEL_WINDOW_HOURS + " hour(s) of confirmation.");
        }

        OrderStatus previousStatus = order.getStatus();
        order.setStatus(OrderStatus.CANCELLED);
        order.getVendorOrders().forEach(vo -> vo.setStatus(OrderStatus.CANCELLED));
        orderRepository.save(order);

        if (order.getWalletAmountUsed() > 0)
            walletService.credit(customerId, order.getWalletAmountUsed(),
                    "Refund for cancelled order #" + orderId, orderId);

        rollbackCoupon(order.getCouponCode(), customerId);

        order.getItems().forEach(i ->
                mongoTemplate.updateFirst(
                        Query.query(Criteria.where("_id").is(i.getProductId())),
                        new Update().inc("stock", i.getQuantity()),
                        Product.class
                ));

        if (previousStatus == OrderStatus.CONFIRMED) {
            order.getItems().stream()
                    .collect(java.util.stream.Collectors.groupingBy(
                            OrderItem::getVendorId,
                            java.util.stream.Collectors.summingDouble(OrderItem::getTotalPrice)))
                    .forEach((vid, vTotal) -> {
                        vendorRepository.findById(vid).ifPresent(v -> {
                            double commission = vTotal * v.getCommissionRate() / 100;
                            double earnings   = vTotal - commission;

                            Query sufficientPayout = Query.query(
                                    Criteria.where("_id").is(vid)
                                            .and("pendingPayout").gte(earnings));
                            Update fullDecrease = new Update()
                                    .inc("totalEarnings", -earnings)
                                    .inc("pendingPayout",  -earnings);

                            Vendor matched = mongoTemplate.findAndModify(
                                    sufficientPayout, fullDecrease, Vendor.class);

                            if (matched == null) {
                                mongoTemplate.updateFirst(
                                        Query.query(Criteria.where("_id").is(vid)),
                                        new Update()
                                                .inc("totalEarnings", -earnings)
                                                .set("pendingPayout", 0),
                                        Vendor.class
                                );
                            }
                        });
                    });
        }

        notificationService.send(order.getCustomerId(), "Order Cancelled",
                "Your order #" + order.getId() + " has been cancelled.",
                "ORDER_CANCELLED", order.getId());
        userRepository.findById(order.getCustomerId()).ifPresent(u ->
                emailService.sendOrderCancelled(u.getEmail(), u.getName(), order.getId()));

        return toResponse(order);
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private void rollbackCoupon(String couponCode, String userId) {
        if (couponCode == null || couponCode.isBlank()) return;

        mongoTemplate.updateFirst(
                Query.query(
                        Criteria.where("code").regex("^" + Pattern.quote(couponCode) + "$", "i")
                                .and("usageCount").gt(0)),
                new Update()
                        .inc("usageCount", -1)
                        .pull("usedByUserIds", userId),
                Coupon.class
        );
    }

    /**
     * Releases stock/coupon/wallet holds for an order whose payment verification
     * failed, and marks it CANCELLED right away. Guarded so it only fires once
     * per order (a customer can retry verifyAndConfirm after a transient failure,
     * but once we've released the holds the order must not be resurrected).
     */
    private void failOrder(Order order) {
        Query stillPending = Query.query(
                Criteria.where("_id").is(order.getId()).and("status").is(OrderStatus.PENDING));
        Update markCancelled = new Update().set("status", OrderStatus.CANCELLED);
        Order updated = mongoTemplate.findAndModify(stillPending, markCancelled, Order.class);
        if (updated == null) return; // already handled (e.g. by the stale-order sweep)

        order.getItems().forEach(item ->
                mongoTemplate.updateFirst(
                        Query.query(Criteria.where("_id").is(item.getProductId())),
                        new Update().inc("stock", item.getQuantity()),
                        Product.class
                ));

        if (order.getWalletAmountUsed() > 0)
            walletService.credit(
                    order.getCustomerId(),
                    order.getWalletAmountUsed(),
                    "Refund: payment verification failed for order #" + order.getId(),
                    order.getId());

        rollbackCoupon(order.getCouponCode(), order.getCustomerId());
    }

    public void cancelStaleOrder(Order claimedOrder) {
        claimedOrder.getItems().forEach(item ->
                mongoTemplate.updateFirst(
                        Query.query(Criteria.where("_id").is(item.getProductId())),
                        new Update().inc("stock", item.getQuantity()),
                        Product.class
                ));

        if (claimedOrder.getWalletAmountUsed() > 0) {
            walletService.credit(
                    claimedOrder.getCustomerId(),
                    claimedOrder.getWalletAmountUsed(),
                    "Refund: payment timeout for order #" + claimedOrder.getId(),
                    claimedOrder.getId());
        }

        rollbackCoupon(claimedOrder.getCouponCode(), claimedOrder.getCustomerId());
    }

    private void postOrderSuccess(Order order) {
        cartRepository.findByUserId(order.getCustomerId()).ifPresent(c -> {
            c.setItems(new ArrayList<>());
            cartRepository.save(c);
        });

        Set<String> vendorIds = new HashSet<>();
        order.getItems().forEach(i -> vendorIds.add(i.getVendorId()));
        vendorIds.forEach(vid ->
                vendorRepository.findById(vid).ifPresent(v -> {
                    double vTotal = order.getItems().stream()
                            .filter(i -> vid.equals(i.getVendorId()))
                            .mapToDouble(OrderItem::getTotalPrice).sum();
                    double commission = vTotal * v.getCommissionRate() / 100;
                    double earnings   = vTotal - commission;
                    mongoTemplate.updateFirst(
                            Query.query(Criteria.where("_id").is(vid)),
                            new Update()
                                    .inc("totalEarnings", earnings)
                                    .inc("pendingPayout",  earnings),
                            Vendor.class
                    );
                    notificationService.send(v.getUserId(), "New Order",
                            "New order #" + order.getId(), "NEW_ORDER", order.getId());
                }));

        notificationService.send(order.getCustomerId(), "Order Confirmed",
                "Your order #" + order.getId() + " is confirmed.",
                "ORDER_CONFIRMED", order.getId());
        userRepository.findById(order.getCustomerId()).ifPresent(u ->
                emailService.sendOrderConfirmation(
                        u.getEmail(), u.getName(), order.getId(), order.getTotalAmount()));
    }

    // Generates and stores an OTP scoped to a single VendorOrder portion. Vendor A
    // can never trigger or read the OTP living on Vendor B's VendorOrder because
    // that OTP is never on a field Vendor A's requests can reach.
    private void ensureDeliveryOtp(Order order, VendorOrder vendorPortion) {
        String otp = String.format("%06d", OTP_RANDOM.nextInt(1_000_000));
        vendorPortion.setDeliveryOtp(otp);
        vendorPortion.setOtpVerified(false);
        vendorPortion.setOtpGeneratedAt(LocalDateTime.now());

        userRepository.findById(order.getCustomerId()).ifPresent(u -> {
            try {
                emailService.sendDeliveryOtp(u.getEmail(), u.getName(), order.getId(), otp);
            } catch (Exception e) {
                log.warn("Delivery OTP email notification failed for order {} and vendor {}. OTP remains available in customer order details.",
                        order.getId(), vendorPortion.getVendorId(), e);
            }
            notificationService.send(order.getCustomerId(), "Delivery OTP Generated",
                    "Your delivery OTP for " + vendorPortion.getVendorName()
                            + "'s items is available in your order details.",
                    "DELIVERY_OTP_GENERATED", order.getId());
        });
    }

    private void sendStatusNotifications(Order order, VendorOrder vendorPortion,
                                         OrderStatus status, String trackingId) {
        switch (status) {
            case CONFIRMED -> {
                notificationService.send(order.getCustomerId(), "Order Confirmed",
                        "Your order #" + order.getId() + " is confirmed.",
                        "ORDER_CONFIRMED", order.getId());
                userRepository.findById(order.getCustomerId()).ifPresent(u ->
                        emailService.sendOrderConfirmation(
                                u.getEmail(), u.getName(), order.getId(), order.getTotalAmount()));
            }
            case SHIPPED -> {
                notificationService.send(order.getCustomerId(), "Order Shipped",
                        "Tracking ID: " + (trackingId != null ? trackingId : vendorPortion.getTrackingId()),
                        "ORDER_SHIPPED", order.getId());
                userRepository.findById(order.getCustomerId()).ifPresent(u ->
                        emailService.sendOrderShipped(
                                u.getEmail(), u.getName(), order.getId(),
                                trackingId != null ? trackingId : vendorPortion.getTrackingId()));
            }
            case OUT_FOR_DELIVERY -> {
                notificationService.send(order.getCustomerId(), "Order Out for Delivery",
                        "Your order is out for delivery. Tracking ID: "
                                + (trackingId != null ? trackingId : vendorPortion.getTrackingId()),
                        "ORDER_OUT_FOR_DELIVERY", order.getId());
                userRepository.findById(order.getCustomerId()).ifPresent(u ->
                        emailService.sendOrderOutForDelivery(
                                u.getEmail(), u.getName(), order.getId(),
                                trackingId != null ? trackingId : vendorPortion.getTrackingId()));
            }
            default -> notificationService.send(order.getCustomerId(), "Order Update",
                    "Your order status is now: " + status,
                    "ORDER_STATUS", order.getId());
        }
    }

    /**
     * Computes and persists commission/earnings for a single vendor's DELIVERED
     * portion of an order. Scoped strictly to that vendor's own items/subtotal —
     * never derived from the whole parent order — so Vendor A's earnings can
     * never be inflated or deflated by Vendor B's products.
     */
    public void updateOrderRevenue(Order order, String vendorId) {
        VendorOrder mine = order.getVendorOrders().stream()
                .filter(vo -> vendorId.equals(vo.getVendorId()))
                .findFirst().orElse(null);
        if (mine == null || mine.getStatus() != OrderStatus.DELIVERED
                || !Boolean.TRUE.equals(mine.getOtpVerified())) {
            return;
        }
        vendorRepository.findById(vendorId).ifPresent(v -> {
            double vTotal = mine.getSubtotal();
            double commission = vTotal * v.getCommissionRate() / 100;
            double earnings   = vTotal - commission;
            mine.setCommissionAmount(commission);
            mine.setVendorEarnings(earnings);

            mongoTemplate.updateFirst(
                    Query.query(Criteria.where("_id").is(order.getId())
                            .and("vendorOrders.vendorId").is(vendorId)),
                    new Update()
                            .set("vendorOrders.$.commissionAmount", commission)
                            .set("vendorOrders.$.vendorEarnings", earnings),
                    Order.class);
        });
    }

    private boolean verifySignature(String orderId, String paymentId, String signature) {
        return razorpayUtil.verifyPaymentSignature(orderId, paymentId, signature);
    }

    /**
     * Finds and returns the authenticated vendor's own VendorOrder sub-document,
     * or throws if this order has no portion belonging to them. This is the
     * single choke point every vendor-mutating endpoint goes through, so a
     * vendor can never read or write another vendor's portion of the order —
     * vendorId always comes from SecurityUtil.currentUserId() -> VendorService,
     * never from client input (see OrderController / VendorController).
     */
    private VendorOrder findVendorOrderOrThrow(Order order, String vendorId) {
        return order.getVendorOrders().stream()
                .filter(vo -> vendorId.equals(vo.getVendorId()))
                .findFirst()
                .orElseThrow(() -> new UnauthorizedException("Not your order"));
    }

    /** Groups checkout items by vendor into isolated VendorOrder portions. */
    private List<VendorOrder> buildVendorOrders(List<OrderItem> orderItems) {
        java.util.LinkedHashMap<String, List<OrderItem>> byVendor = new java.util.LinkedHashMap<>();
        for (OrderItem item : orderItems) {
            byVendor.computeIfAbsent(item.getVendorId(), k -> new ArrayList<>()).add(item);
        }
        List<VendorOrder> result = new ArrayList<>();
        byVendor.forEach((vendorId, items) -> {
            double subtotal = items.stream().mapToDouble(OrderItem::getTotalPrice).sum();
            result.add(VendorOrder.builder()
                    .id(UUID.randomUUID().toString())
                    .vendorId(vendorId)
                    .vendorName(items.get(0).getVendorName())
                    .items(items)
                    .status(OrderStatus.PENDING)
                    .subtotal(subtotal)
                    .build());
        });
        return result;
    }

    /**
     * Marks every vendor portion CONFIRMED once payment/checkout succeeds. Package/
     * cross-service visible so async confirmation paths (e.g. the Razorpay webhook
     * fallback in PaymentWebhookController) also confirm every vendor's sub-order,
     * not just the parent Order — otherwise a customer's payment gets confirmed at
     * the parent level while every VendorOrder stays stuck at PENDING forever, since
     * vendors only ever read their own VendorOrder.status, never the parent's.
     */
    public void confirmAllVendorOrders(Order order) {
        LocalDateTime now = LocalDateTime.now();
        order.setStatus(OrderStatus.CONFIRMED);
        order.setConfirmedAt(now);
        order.getVendorOrders().forEach(vo -> {
            vo.setStatus(OrderStatus.CONFIRMED);
            vo.setConfirmedAt(now);
        });
    }

    /**
     * Aggregation rule for the customer/admin-facing Order.status (requirement #9):
     *  - if every vendor portion is CANCELLED  -> CANCELLED
     *  - if every (non-cancelled) vendor portion is DELIVERED -> DELIVERED
     *  - otherwise -> the furthest-progressed status among non-cancelled portions,
     *    where DELIVERED portions don't count toward "furthest" unless ALL are
     *    delivered (so one vendor finishing early never flips the parent to
     *    DELIVERED while another vendor is still shipping).
     * A single vendor's update therefore only ever nudges the parent forward
     * from its own progress — it never overwrites/forces every other vendor's
     * state.
     */
    OrderStatus computeParentStatus(List<VendorOrder> vendorOrders) {
        List<OrderStatus> active = vendorOrders.stream()
                .map(VendorOrder::getStatus)
                .filter(s -> s != OrderStatus.CANCELLED && s != OrderStatus.REFUNDED)
                .toList();
        if (active.isEmpty()) return OrderStatus.CANCELLED;

        boolean allDelivered = active.stream().allMatch(s -> s == OrderStatus.DELIVERED);
        if (allDelivered) return OrderStatus.DELIVERED;

        int bestIdx = active.stream()
                .filter(s -> s != OrderStatus.DELIVERED)
                .mapToInt(STATUS_ORDER::indexOf)
                .max()
                .orElse(STATUS_ORDER.indexOf(OrderStatus.OUT_FOR_DELIVERY)); // all-but-one delivered case
        return STATUS_ORDER.get(bestIdx);
    }

    private void recomputeParentStatus(Order order) {
        order.setStatus(computeParentStatus(order.getVendorOrders()));
        if (order.getStatus() == OrderStatus.DELIVERED) {
            order.setDeliveredAt(LocalDateTime.now());
        }
    }

    /**
     * Builds a vendor-scoped OrderResponse: `items` and `vendorOrders` contain
     * ONLY the requesting vendor's portion, and `status`/`trackingId`/etc reflect
     * that vendor's own fulfillment state — never another vendor's, and never
     * the raw parent aggregate.
     */
    public OrderResponse toVendorResponse(Order o, String vendorId) {
        VendorOrder mine = o.getVendorOrders().stream()
                .filter(vo -> vendorId.equals(vo.getVendorId()))
                .findFirst()
                .orElseThrow(() -> new UnauthorizedException("Not your order"));

        return OrderResponse.builder()
                .id(o.getId())
                .customerId(o.getCustomerId())
                .customerName(o.getCustomerName())
                .items(mine.getItems())
                .vendorOrders(List.of(mine))
                .shippingAddress(o.getShippingAddress())
                .totalAmount(mine.getSubtotal())
                .couponCode(o.getCouponCode())
                .status(mine.getStatus())
                .trackingId(mine.getTrackingId())
                .placedAt(o.getPlacedAt())
                .deliveredAt(mine.getDeliveredAt())
                .deliveryOtpGenerated(mine.getDeliveryOtp() != null)
                .otpVerified(mine.getOtpVerified())
                .otpGeneratedAt(mine.getOtpGeneratedAt())
                .courierName(mine.getCourierName())
                .shippedDate(mine.getShippedDate())
                .commissionAmount(mine.getCommissionAmount())
                .vendorEarnings(mine.getVendorEarnings())
                .build();
    }

    public Order findById(String id) {
        return orderRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Order", id));
    }

    public void triggerPostOrderSuccess(Order order) {
        postOrderSuccess(order);
    }

    // FIXED critical-2: atomic coupon claim — eliminates check-then-act race condition.
    // findAndModify with all validity conditions in the query ensures exactly one
    // concurrent request can claim a coupon slot; others get a null result and fail fast.
    private double applyCoupon(String code, String userId, double total) {
        Coupon coupon = couponRepository.findByCodeIgnoreCase(code)
                .orElseThrow(() -> new ResourceNotFoundException("Coupon", code));

        // Read-only pre-checks (fast-fail before the atomic op)
        if (!coupon.isActive())
            throw new IllegalArgumentException("Coupon is inactive");
        if (coupon.getExpiresAt().isBefore(LocalDateTime.now()))
            throw new IllegalArgumentException("Coupon has expired");
        if (total < coupon.getMinimumOrderValue())
            throw new IllegalArgumentException(
                    "Order does not meet minimum value for this coupon");
        if (coupon.getUsedByUserIds().contains(userId))
            throw new IllegalArgumentException("You have already used this coupon");

        // Atomic claim: only succeeds if usage slot is still available AND user not already in set
        Query claimQuery = Query.query(
                Criteria.where("_id").is(coupon.getId())
                        .and("isActive").is(true)
                        .and("usedByUserIds").nin(userId)
                        .orOperator(
                                Criteria.where("usageLimit").lte(0),
                                Criteria.where("usageCount").lt(coupon.getUsageLimit())
                        )
        );
        Update claimUpdate = new Update()
                .inc("usageCount", 1)
                .addToSet("usedByUserIds", userId);

        Coupon claimed = mongoTemplate.findAndModify(claimQuery, claimUpdate, Coupon.class);
        if (claimed == null)
            throw new IllegalArgumentException(
                    "Coupon usage limit has been reached or is no longer valid");

        double discount = claimed.getDiscountType() == Coupon.DiscountType.PERCENTAGE
                ? total * claimed.getDiscountValue() / 100
                : claimed.getDiscountValue();
        if (claimed.getMaxDiscount() > 0)
            discount = Math.min(discount, claimed.getMaxDiscount());
        return discount;
    }

    public OrderResponse toResponse(Order o) {
        return OrderResponse.builder()
                .id(o.getId())
                .customerId(o.getCustomerId())
                .customerName(o.getCustomerName())
                .items(o.getItems())
                .vendorOrders(o.getVendorOrders())
                .shippingAddress(o.getShippingAddress())
                .totalAmount(o.getTotalAmount())
                .discountAmount(o.getDiscountAmount())
                .walletAmountUsed(o.getWalletAmountUsed())
                .razorpayAmount(o.getRazorpayAmount())
                .couponCode(o.getCouponCode())
                .razorpayOrderId(o.getRazorpayOrderId())
                .paymentId(o.getPaymentId())
                .status(o.getStatus())
                .trackingId(o.getTrackingId())
                .placedAt(o.getPlacedAt())
                .deliveredAt(o.getDeliveredAt())

                .deliveryOtpGenerated(o.getVendorOrders().stream()
                        .anyMatch(vo -> vo.getDeliveryOtp() != null))
                .otpVerified(o.getOtpVerified())
                .otpGeneratedAt(o.getOtpGeneratedAt())

                .courierName(o.getCourierName())
                .shippedDate(o.getShippedDate())

                .commissionAmount(o.getCommissionAmount())
                .vendorEarnings(o.getVendorEarnings())
                .build();
    }
}
