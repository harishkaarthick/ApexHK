package com.marketplace.service;

import com.marketplace.config.PlanConfig;
import com.marketplace.enums.SubscriptionStatus;
import com.marketplace.model.Vendor;
import com.marketplace.repository.VendorRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

/**
 * FIX §2.1 / §7: Automatic subscription expiry.
 *
 * Runs hourly. Finds vendors whose paid plan has passed subscriptionValidUntil
 * and atomically downgrades them to FREE so productLimit/commissionRate/status
 * reflect reality without any manual intervention.
 *
 * ShedLock ensures only one instance runs per firing interval in a multi-pod
 * deployment, matching the existing pattern used for cancelStalePendingOrders()
 * in PaymentWebhookController.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SubscriptionExpiryScheduler {

    private final VendorRepository    vendorRepository;
    private final MongoTemplate       mongoTemplate;
    private final NotificationService notificationService;

    @Scheduled(cron = "${app.subscription.expiry-cron:0 0 * * * *}") // hourly by default
    @SchedulerLock(
            name          = "expireVendorSubscriptions",
            lockAtMostFor = "PT5M",
            lockAtLeastFor = "PT1M"
    )
    public void expireSubscriptions() {
        LocalDateTime now = LocalDateTime.now();

        List<Vendor> expiring = vendorRepository
                .findBySubscriptionStatusAndSubscriptionValidUntilBefore(
                        SubscriptionStatus.ACTIVE, now);

        // Filter out FREE-plan vendors: FREE is perpetually ACTIVE and should never
        // be "expired" (its validUntil is just a rolling 30-day window for bookkeeping).
        List<Vendor> paidExpiring = expiring.stream()
                .filter(v -> !"FREE".equalsIgnoreCase(v.getSubscriptionPlan()))
                .toList();

        if (paidExpiring.isEmpty()) return;

        log.info("Subscription expiry sweep: {} vendor(s) with expired paid plans", paidExpiring.size());

        for (Vendor vendor : paidExpiring) {
            try {
                // Atomic claim: skip if another instance/job already processed this vendor.
                Query q = Query.query(
                        Criteria.where("_id").is(vendor.getId())
                                .and("subscriptionStatus").is(SubscriptionStatus.ACTIVE)
                                .and("subscriptionValidUntil").lt(now)
                                .and("subscriptionPlan").ne("FREE"));
                Update u = new Update()
                        .set("subscriptionPlan",       PlanConfig.FREE.name())
                        .set("productLimit",           PlanConfig.FREE.getProductLimit())
                        .set("commissionRate",         PlanConfig.FREE.getCommissionRate())
                        .set("subscriptionStatus",     SubscriptionStatus.EXPIRED)
                        // Roll the FREE window forward so this vendor isn't re-flagged next sweep.
                        .set("subscriptionValidUntil",
                                now.plusDays(PlanConfig.FREE.getValidityDays()));

                Vendor claimed = mongoTemplate.findAndModify(q, u, Vendor.class);
                if (claimed == null) continue; // another instance already handled it

                notificationService.send(
                        vendor.getUserId(),
                        "Subscription Expired",
                        "Your " + claimed.getSubscriptionPlan() + " plan has expired. "
                                + "Your account has been moved to the FREE plan — renew to restore your benefits.",
                        "SUBSCRIPTION_EXPIRED",
                        vendor.getId());

                log.info("Vendor {} ({}) downgraded to FREE after subscription expiry",
                        vendor.getId(), claimed.getSubscriptionPlan());

            } catch (Exception e) {
                log.error("Error expiring subscription for vendor {}: {}",
                        vendor.getId(), e.getMessage());
            }
        }

        // Optional: rolling expiry warning sweep (fires before expiry, not after).
        sendExpiryWarnings(now);
    }

    /**
     * Sends an "expiring soon" notification to vendors whose paid plan expires
     * within the next 3 days. Low-cost — only queries, no writes.
     */
    private void sendExpiryWarnings(LocalDateTime now) {
        LocalDateTime warningWindow = now.plusDays(3);
        List<Vendor> warnVendors = vendorRepository
                .findBySubscriptionStatusAndSubscriptionValidUntilBefore(
                        SubscriptionStatus.ACTIVE, warningWindow)
                .stream()
                .filter(v -> !"FREE".equalsIgnoreCase(v.getSubscriptionPlan()))
                // Only warn about vendors whose plan hasn't ALREADY expired
                .filter(v -> v.getSubscriptionValidUntil() != null
                        && v.getSubscriptionValidUntil().isAfter(now))
                .toList();

        for (Vendor vendor : warnVendors) {
            try {
                long daysLeft = java.time.Duration.between(now, vendor.getSubscriptionValidUntil())
                        .toDays() + 1;
                notificationService.send(
                        vendor.getUserId(),
                        "Subscription Expiring Soon",
                        "Your " + vendor.getSubscriptionPlan() + " plan expires in "
                                + daysLeft + " day" + (daysLeft == 1 ? "" : "s")
                                + ". Renew now to avoid losing your benefits.",
                        "SUBSCRIPTION_EXPIRING_SOON",
                        vendor.getId());
            } catch (Exception e) {
                log.warn("Error sending expiry warning for vendor {}: {}",
                        vendor.getId(), e.getMessage());
            }
        }
    }
}
