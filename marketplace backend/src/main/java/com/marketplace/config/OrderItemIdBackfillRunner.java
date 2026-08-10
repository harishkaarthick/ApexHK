package com.marketplace.config;

import com.marketplace.model.Order;
import com.marketplace.model.OrderItem;
import com.marketplace.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.UUID;

/**
 * One-time, idempotent data fix for the "orderItemId: must not be blank" return-button bug.
 *
 * Root cause: OrderItem.id is only populated by OrderService.checkout() since the fix that
 * added `.id(UUID.randomUUID().toString())` when building order items. Orders placed before
 * that fix have items persisted in MongoDB with no `id` field at all, so when the frontend
 * sends `orderItemId: item.id` it's `undefined` -> the key is dropped from the JSON body ->
 * Spring's @NotBlank rejects the request before ReturnService is ever called.
 *
 * This runner scans for orders containing items with a missing/null/blank id and assigns
 * each one a fresh UUID, then saves the order back. It is safe to run on every startup:
 * once every item has an id, the query matches nothing and this is a no-op.
 */
// MUST run before VendorOrderBackfillRunner (@Order(2)): that runner copies
// OrderItem references (including whatever id they currently have, or lack)
// into VendorOrder.items. If it ran first, legacy items backfilled with an id
// here afterwards would never propagate into the already-persisted
// vendorOrders copies (separate Mongo documents loaded/saved independently),
// permanently leaving vendor-scoped items without an id.
@Slf4j
@Component
@RequiredArgsConstructor
@org.springframework.core.annotation.Order(1)
public class OrderItemIdBackfillRunner implements ApplicationRunner {

    private final MongoTemplate mongoTemplate;
    private final OrderRepository orderRepository;

    @Override
    public void run(ApplicationArguments args) {
        Query query = new Query(new Criteria().orOperator(
                Criteria.where("items.id").exists(false),
                Criteria.where("items.id").is(null),
                Criteria.where("items.id").is("")
        ));

        List<Order> affectedOrders = mongoTemplate.find(query, Order.class);

        if (affectedOrders.isEmpty()) {
            log.info("OrderItemIdBackfillRunner: no legacy order items missing an id. Nothing to do.");
            return;
        }

        int ordersFixed = 0;
        int itemsFixed = 0;

        for (Order order : affectedOrders) {
            boolean changed = false;
            for (OrderItem item : order.getItems()) {
                if (item.getId() == null || item.getId().isBlank()) {
                    item.setId(UUID.randomUUID().toString());
                    changed = true;
                    itemsFixed++;
                }
            }
            if (changed) {
                orderRepository.save(order);
                ordersFixed++;
            }
        }

        log.warn("OrderItemIdBackfillRunner: backfilled {} order item id(s) across {} legacy order(s). "
                + "Returns can now be requested for these orders.", itemsFixed, ordersFixed);
    }
}
