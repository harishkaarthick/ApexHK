package com.marketplace.config;

import net.javacrumbs.shedlock.core.LockProvider;
import net.javacrumbs.shedlock.provider.mongo.MongoLockProvider;
import net.javacrumbs.shedlock.spring.annotation.EnableSchedulerLock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.mongodb.core.MongoTemplate;

/**
 * ADD-04 FIX: Distributed scheduler lock configuration using ShedLock + MongoDB.
 *
 * Problem: @Scheduled jobs run in every application instance. In a horizontally
 * scaled deployment (multiple pods, rolling deploys) the cancelStalePendingOrders()
 * cleanup job fires simultaneously on all instances. The per-order findAndModify
 * claim is idempotent, but concurrent executions multiply MongoDB load and —
 * critically — any non-idempotent side effect added in the future (cancellation
 * emails, push notifications) would fire N times per order.
 *
 * Fix: ShedLock writes a "lock" document in MongoDB before running the job and
 * deletes it afterward. Only one instance acquires the lock; the others skip that
 * firing. The lock collection is called "shedlock" and is auto-created on first run.
 *
 * lockAtMostFor = 4 minutes: the lock is forcibly released after 4 min even if the
 * instance crashes mid-job, preventing a permanent deadlock.
 *
 * lockAtLeastFor = 1 minute (set on the @SchedulerLock annotation): prevents a
 * second instance from picking up the lock immediately after a very fast run,
 * which could cause near-simultaneous double execution on a fast cluster.
 */
@Configuration
@EnableSchedulerLock(defaultLockAtMostFor = "PT4M")
public class SchedulerConfig {

    /**
     * Uses the application's existing MongoTemplate (same connection, same database)
     * so no additional MongoDB connection or credentials are needed.
     */
    @Bean
    public LockProvider lockProvider(MongoTemplate mongoTemplate) {
        return new MongoLockProvider(mongoTemplate.getDb());
    }
}
