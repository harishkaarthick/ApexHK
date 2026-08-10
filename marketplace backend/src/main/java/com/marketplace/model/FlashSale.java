package com.marketplace.model;

import lombok.*;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FlashSale {
    private double salePrice;
    private LocalDateTime startTime;
    private LocalDateTime endTime;

    /**
     * FIX H-4: The original implementation used LocalDateTime.now(), which has
     * no timezone attached. On a server running in a non-UTC timezone the
     * flash-sale window would be off by hours relative to the UTC times stored
     * in MongoDB (the application serialises LocalDateTime as UTC via Jackson's
     * spring.jackson.time-zone=UTC setting).
     *
     * Fix: convert startTime and endTime to UTC Instants and compare against
     * Instant.now(), which is always UTC. This guarantees correct behaviour
     * regardless of the JVM's default timezone.
     */
    public boolean isActive() {
        if (startTime == null || endTime == null) return false;
        Instant now   = Instant.now();
        Instant start = startTime.toInstant(ZoneOffset.UTC);
        Instant end   = endTime.toInstant(ZoneOffset.UTC);
        return now.isAfter(start) && now.isBefore(end);
    }
}