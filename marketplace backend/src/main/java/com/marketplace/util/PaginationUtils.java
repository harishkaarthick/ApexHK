package com.marketplace.util;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

public final class PaginationUtils {

    public static final int MAX_PAGE_SIZE = 50;

    private PaginationUtils() {
    }

    public static Pageable page(int page, int size) {
        return PageRequest.of(page, clampSize(size));
    }

    public static Pageable page(int page, int size, Sort sort) {
        return PageRequest.of(page, clampSize(size), sort);
    }

    private static int clampSize(int size) {
        return Math.min(size, MAX_PAGE_SIZE);
    }
}
