package com.marketplace.util;

import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Sort;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PaginationUtilsTest {

    @Test
    void clampsPageSizeToMaximum() {
        assertThat(PaginationUtils.page(0, 500).getPageSize()).isEqualTo(PaginationUtils.MAX_PAGE_SIZE);
    }

    @Test
    void preservesNormalPageSizeAndSort() {
        var pageable = PaginationUtils.page(1, 20, Sort.by("createdAt").descending());

        assertThat(pageable.getPageNumber()).isEqualTo(1);
        assertThat(pageable.getPageSize()).isEqualTo(20);
        assertThat(pageable.getSort().getOrderFor("createdAt")).isNotNull();
    }

    @Test
    void negativePageRemainsInvalid() {
        assertThatThrownBy(() -> PaginationUtils.page(-1, 20))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
