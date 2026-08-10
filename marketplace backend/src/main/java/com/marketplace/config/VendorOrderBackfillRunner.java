package com.marketplace.config;

import com.marketplace.model.OrderItem;
import com.marketplace.model.VendorOrder;
import com.marketplace.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.UUID;

/**
 * One-time, idempotent migration for the multi-vendor order isolation fix.
 *
 * Root cause: orders placed before this fix only have a flat `items` list and
 * a single shared `status`/`trackingId`/etc at the top level of Order, with no
 * per-vendor breakdown. Vendor-facing endpoints now read exclusively from
 * `vendorOrders`, so without this backfill those legacy orders would simply
 * vanish from every vendor's order list (they'd fail the
 * `vendorOrders.vendorId == vendorId` query).
 *
 * This runner finds every order with an empty/missing `vendorOrders` list but
 * a non-empty `items` list, groups those items by vendorId, and builds one
 * VendorOrder per vendor — carrying over the legacy top-level status,
 * trackingId, courierName, shippedDate, deliveredAt, and OTP fields as that
 * vendor's starting state (correct for the common case where the legacy order
 * only ever had one vendor; for legacy orders that already mixed vendors,
 * every vendor portion starts from the same shared status, which is the best
 * available approximation of history that was never tracked per vendor).
 *
 * Safe to run on every startup: once every order has a populated
 * `vendorOrders` list, the query matches nothing and this is a no-op. No
 * existing order is ever deleted or has its `items`/payment fields touched.
 */
// MUST run after OrderItemIdBackfillRunner (@Order(1)) so that legacy
// OrderItems already have a stable id by the time they're copied into
// VendorOrder.items — see the note on that runner for why the reverse order
// would silently leave vendor-scoped items without an id forever.
@Slf4j
@Component
@RequiredArgsConstructor
@Order(2)
public class VendorOrderBackfillRunner implements ApplicationRunner {

    private final MongoTemplate mongoTemplate;
    private final OrderRepository orderRepository;

    @Override
    public void run(ApplicationArguments args) {
        Query query = new Query(new Criteria().andOperator(
                Criteria.where("items").exists(true).not().size(0),
                new Criteria().orOperator(
                        Criteria.where("vendorOrders").exists(false),
                        Criteria.where("vendorOrders").size(0)
                )
        ));

        List<com.marketplace.model.Order> legacyOrders = mongoTemplate.find(query, com.marketplace.model.Order.class);

        if (legacyOrders.isEmpty()) {
            log.info("VendorOrderBackfillRunner: no legacy orders missing vendorOrders. Nothing to do.");
            return;
        }

        int fixed = 0;
        for (com.marketplace.model.Order order : legacyOrders) {
            LinkedHashMap<String, List<OrderItem>> byVendor = new LinkedHashMap<>();
            for (OrderItem item : order.getItems()) {
                byVendor.computeIfAbsent(item.getVendorId(), k -> new ArrayList<>()).add(item);
            }

            List<VendorOrder> vendorOrders = new ArrayList<>();
            byVendor.forEach((vendorId, items) -> {
                double subtotal = items.stream().mapToDouble(OrderItem::getTotalPrice).sum();
                vendorOrders.add(VendorOrder.builder()
                        .id(UUID.randomUUID().toString())
                        .vendorId(vendorId)
                        .vendorName(items.get(0).getVendorName())
                        .parentOrderId(order.getId())
                        .items(items)
                        .status(order.getStatus())
                        .confirmedAt(order.getConfirmedAt())
                        .cancellationReason(order.getCancellationReason())
                        .trackingId(order.getTrackingId())
                        .courierName(order.getCourierName())
                        .shippedDate(order.getShippedDate())
                        .deliveredAt(order.getDeliveredAt())
                        .deliveryOtp(order.getDeliveryOtp())
                        .otpVerified(order.getOtpVerified())
                        .otpGeneratedAt(order.getOtpGeneratedAt())
                        .subtotal(subtotal)
                        .commissionAmount(order.getCommissionAmount())
                        .vendorEarnings(order.getVendorEarnings())
                        .build());
            });

            order.setVendorOrders(vendorOrders);
            orderRepository.save(order);
            fixed++;
        }

        log.warn("VendorOrderBackfillRunner: backfilled vendorOrders for {} legacy order(s). "
                + "Vendor order isolation is now active for these orders too.", fixed);
    }
}
