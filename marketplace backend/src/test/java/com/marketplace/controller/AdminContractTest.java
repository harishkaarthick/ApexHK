package com.marketplace.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.marketplace.dto.response.AdminOrderResponse;
import com.marketplace.dto.response.DashboardStats;
import com.marketplace.dto.response.PagedResponse;
import com.marketplace.enums.OrderStatus;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class AdminContractTest {

    private final ObjectMapper mapper = new ObjectMapper()
            .registerModule(new JavaTimeModule())
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

    @Test
    void dashboardStatsSerializesExactlyTheFrontendContract() throws Exception {
        // Fix A: .approvedPayouts() was removed from DashboardStats when approvePayout()
        // was found to transition PENDING → PAID directly, making APPROVED unreachable.
        // The field was renamed to paidPayouts; the builder call and the key assertion
        // below must both reflect that rename or the test fails to compile.
        DashboardStats stats = DashboardStats.builder()
                .totalUsers(10)
                .totalVendors(5)
                .pendingVendors(2)
                .pendingPayouts(3)
                .paidPayouts(4)
                .totalPayoutAmount(12500)
                .totalOrders(20)
                .totalRevenue(5000)
                .totalProducts(50)
                .build();

        JsonNode json = mapper.readTree(mapper.writeValueAsString(stats));

        assertThat(keys(json)).containsExactlyInAnyOrder(
                "totalUsers",
                "totalVendors",
                "pendingVendors",
                "pendingPayouts",
                "paidPayouts",
                "totalPayoutAmount",
                "totalOrders",
                "totalRevenue",
                "totalProducts"
        );
        assertThat(json.get("totalUsers").asLong()).isEqualTo(10);
        assertThat(json.get("pendingPayouts").asLong()).isEqualTo(3);
        assertThat(json.get("totalPayoutAmount").asDouble()).isEqualTo(12500);
        assertThat(json.get("totalProducts").asLong()).isEqualTo(50);
    }

    @Test
    void adminOrderSerializesFieldsUsedByTheFrontend() throws Exception {
        AdminOrderResponse order = AdminOrderResponse.builder()
                .id("order-1")
                .items(List.of())
                .total(120.50)
                .totalAmount(120.50)
                .status(OrderStatus.PENDING)
                .placedAt(LocalDateTime.parse("2026-06-01T10:00:00"))
                .build();

        JsonNode json = mapper.readTree(mapper.writeValueAsString(order));

        assertThat(json.has("id")).isTrue();
        assertThat(json.has("items")).isTrue();
        assertThat(json.get("total").asDouble()).isEqualTo(120.50);
        assertThat(json.get("status").asText()).isEqualTo("PENDING");
        assertThat(json.has("placedAt")).isTrue();
    }

    @Test
    void pagedResponseSerializesSpringPageAndFrontendAliases() throws Exception {
        PageImpl<String> page = new PageImpl<>(
                List.of("a", "b", "c"),
                PageRequest.of(0, 5),
                3
        );

        JsonNode json = mapper.readTree(mapper.writeValueAsString(PagedResponse.of(page)));

        assertThat(json.get("content")).hasSize(3);
        assertThat(json.get("totalPages").asInt()).isEqualTo(1);
        assertThat(json.get("totalElements").asLong()).isEqualTo(3);
        assertThat(json.get("number").asInt()).isEqualTo(0);
        assertThat(json.get("size").asInt()).isEqualTo(5);
        assertThat(json.get("currentPage").asInt()).isEqualTo(0);
        assertThat(json.get("pageSize").asInt()).isEqualTo(5);
    }

    private static Set<String> keys(JsonNode json) {
        Set<String> keys = new HashSet<>();
        Iterator<String> names = json.fieldNames();
        while (names.hasNext()) {
            keys.add(names.next());
        }
        return keys;
    }
}