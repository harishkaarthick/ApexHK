package com.marketplace.dto.response;

import lombok.*;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProductSearchResponse {
    private List<ProductResponse> content;
    private int currentPage;
    private int number;
    private int totalPages;
    private long totalElements;
    private int pageSize;
    private int size;
    private boolean first;
    private boolean last;
    private List<String> suggestions;
    private String correctedQuery;
}
