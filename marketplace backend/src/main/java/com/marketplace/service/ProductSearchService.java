package com.marketplace.service;

import com.marketplace.dto.response.ProductResponse;
import com.marketplace.dto.response.ProductSearchResponse;
import com.marketplace.model.Product;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class ProductSearchService {

    private static final List<String> SEARCH_FIELDS = List.of(
            "name", "brand", "category", "subcategory", "description", "tags", "sku");

    private final MongoTemplate mongoTemplate;
    private final ProductSearchSynonymService synonymService;

    public ProductSearchResponse search(
            String rawQuery,
            Pageable pageable,
            String category,
            String brand,
            Double minPrice,
            Double maxPrice,
            Double minRating,
            Boolean inStock,
            String sort,
            ProductService productService) {

        String normalized = normalize(rawQuery);
        List<String> terms = tokenize(normalized);
        Criteria baseCriteria = publicProductCriteria(category, brand, minPrice, maxPrice, minRating, inStock);

        if (terms.isEmpty()) {
            Query listQuery = Query.query(baseCriteria).with(pageable);
            long total = mongoTemplate.count(Query.query(baseCriteria), Product.class);
            List<ProductResponse> content = mongoTemplate.find(listQuery, Product.class)
                    .stream().map(productService::toResponse).toList();
            return response(content, pageable, total, List.of(), null);
        }

        List<String> expandedTerms = synonymService.expand(terms);
        Criteria searchCriteria = new Criteria().andOperator(baseCriteria, anyTermCriteria(expandedTerms));
        long total = mongoTemplate.count(Query.query(searchCriteria), Product.class);

        int candidateLimit = Math.max(pageable.getPageSize() * 5, 80);
        candidateLimit = Math.min(candidateLimit + (int) pageable.getOffset(), 250);
        Query query = Query.query(searchCriteria).limit(candidateLimit);
        if (isExplicitSort(sort)) {
            query.with(toSort(sort));
        }

        List<ScoredProduct> scored = mongoTemplate.find(query, Product.class).stream()
                .map(product -> new ScoredProduct(product, score(product, normalized, terms, expandedTerms)))
                .filter(item -> item.score() > 0)
                .toList();
        if (!isExplicitSort(sort)) {
            scored = scored.stream()
                    .sorted(Comparator.comparingInt(ScoredProduct::score).reversed()
                            .thenComparing(item -> Optional.ofNullable(item.product().getCreatedAt()).orElse(java.time.LocalDateTime.MIN), Comparator.reverseOrder()))
                    .toList();
        }

        int from = Math.min((int) pageable.getOffset(), scored.size());
        int to = Math.min(from + pageable.getPageSize(), scored.size());
        List<ProductResponse> content = scored.subList(from, to).stream()
                .map(ScoredProduct::product)
                .map(productService::toResponse)
                .toList();

        List<String> suggestions = suggestions(normalized, terms, baseCriteria);
        String correctedQuery = content.isEmpty() && !suggestions.isEmpty() ? suggestions.get(0) : null;
        long resultTotal = Math.min(total, scored.size());
        return response(content, pageable, resultTotal, suggestions, correctedQuery);
    }

    public ProductSearchResponse autocomplete(String rawQuery, ProductService productService) {
        Pageable pageable = PageRequest.of(0, 5);
        ProductSearchResponse result = search(rawQuery, pageable, null, null, null, null, null, null, "relevance", productService);
        if (result.getSuggestions() == null || result.getSuggestions().isEmpty()) {
            String normalized = normalize(rawQuery);
            result.setSuggestions(suggestions(normalized, tokenize(normalized), publicProductCriteria(null, null, null, null, null, null)));
        }
        return result;
    }

    private Criteria publicProductCriteria(String category, String brand, Double minPrice, Double maxPrice, Double minRating, Boolean inStock) {
        List<Criteria> filters = new ArrayList<>();
        filters.add(Criteria.where("isActive").is(true));
        if (hasText(category)) filters.add(Criteria.where("category").regex(exactRegex(category), "i"));
        if (hasText(brand)) filters.add(Criteria.where("brand").regex(exactRegex(brand), "i"));
        if (minPrice != null || maxPrice != null) {
            Criteria price = Criteria.where("price");
            if (minPrice != null) price = price.gte(minPrice);
            if (maxPrice != null) price = price.lte(maxPrice);
            filters.add(price);
        }
        if (minRating != null) filters.add(Criteria.where("averageRating").gte(minRating));
        if (Boolean.TRUE.equals(inStock)) filters.add(Criteria.where("stock").gt(0));
        return new Criteria().andOperator(filters.toArray(Criteria[]::new));
    }

    private Criteria anyTermCriteria(List<String> terms) {
        List<Criteria> matches = new ArrayList<>();
        for (String term : terms) {
            Pattern pattern = Pattern.compile(Pattern.quote(term), Pattern.CASE_INSENSITIVE);
            for (String field : SEARCH_FIELDS) {
                matches.add(Criteria.where(field).regex(pattern));
            }
        }
        return new Criteria().orOperator(matches.toArray(Criteria[]::new));
    }

    private int score(Product product, String normalized, List<String> terms, List<String> expandedTerms) {
        int score = 0;
        String name = normalize(product.getName());
        if (name.equals(normalized)) score += 300;
        score += fieldScore(name, terms, expandedTerms, 90);
        score += fieldScore(normalize(product.getBrand()), terms, expandedTerms, 70);
        score += fieldScore(normalize(product.getCategory()), terms, expandedTerms, 65);
        score += fieldScore(normalize(product.getSubcategory()), terms, expandedTerms, 55);
        score += product.getTags() == null ? 0 : product.getTags().stream().map(this::normalize).mapToInt(v -> fieldScore(v, terms, expandedTerms, 40)).sum();
        score += fieldScore(normalize(product.getDescription()), terms, expandedTerms, 18);
        score += fieldScore(normalize(product.getSku()), terms, expandedTerms, 12);
        return score;
    }

    private int fieldScore(String value, List<String> terms, List<String> expandedTerms, int weight) {
        if (!hasText(value)) return 0;
        int score = 0;
        for (String term : terms) {
            if (value.equals(term)) score += weight * 2;
            else if (value.contains(term)) score += weight;
        }
        for (String term : expandedTerms) {
            if (!terms.contains(term) && value.contains(term)) score += Math.max(5, weight / 2);
        }
        return score;
    }

    private List<String> suggestions(String normalized, List<String> terms, Criteria baseCriteria) {
        if (!hasText(normalized)) return List.of();
        Query query = Query.query(baseCriteria).limit(120);
        query.fields().include("name").include("brand").include("category").include("subcategory").include("tags");
        return mongoTemplate.find(query, Product.class).stream()
                .flatMap(product -> suggestionValues(product).stream())
                .filter(this::hasText)
                .map(this::normalizeDisplay)
                .distinct()
                .filter(value -> closeEnough(normalized, terms, normalize(value)))
                .limit(6)
                .toList();
    }

    private List<String> suggestionValues(Product product) {
        List<String> values = new ArrayList<>();
        values.add(product.getBrand());
        values.add(product.getName());
        values.add(product.getCategory());
        values.add(product.getSubcategory());
        if (product.getTags() != null) values.addAll(product.getTags());
        return values;
    }

    private boolean closeEnough(String normalized, List<String> terms, String candidate) {
        if (candidate.contains(normalized) || normalized.contains(candidate)) return true;
        for (String term : terms) {
            for (String candidateTerm : tokenize(candidate)) {
                if (candidateTerm.startsWith(term) || levenshtein(term, candidateTerm) <= typoDistance(term)) return true;
            }
        }
        return false;
    }

    private int typoDistance(String term) {
        return term.length() <= 4 ? 1 : 2;
    }

    private int levenshtein(String a, String b) {
        int[] costs = new int[b.length() + 1];
        for (int j = 0; j < costs.length; j++) costs[j] = j;
        for (int i = 1; i <= a.length(); i++) {
            costs[0] = i;
            int nw = i - 1;
            for (int j = 1; j <= b.length(); j++) {
                int cj = Math.min(1 + Math.min(costs[j], costs[j - 1]), a.charAt(i - 1) == b.charAt(j - 1) ? nw : nw + 1);
                nw = costs[j];
                costs[j] = cj;
            }
        }
        return costs[b.length()];
    }

    private ProductSearchResponse response(List<ProductResponse> content, Pageable pageable, long total, List<String> suggestions, String correctedQuery) {
        int totalPages = pageable.getPageSize() == 0 ? 0 : (int) Math.ceil((double) total / pageable.getPageSize());
        return ProductSearchResponse.builder()
                .content(content)
                .currentPage(pageable.getPageNumber())
                .number(pageable.getPageNumber())
                .totalPages(totalPages)
                .totalElements(total)
                .pageSize(pageable.getPageSize())
                .size(pageable.getPageSize())
                .first(pageable.getPageNumber() == 0)
                .last(pageable.getPageNumber() + 1 >= totalPages)
                .suggestions(suggestions)
                .correctedQuery(correctedQuery)
                .build();
    }

    private Sort toSort(String sort) {
        return switch (sort == null ? "" : sort) {
            case "priceAsc" -> Sort.by("price").ascending();
            case "priceDesc" -> Sort.by("price").descending();
            case "rating" -> Sort.by("averageRating").descending();
            case "newest" -> Sort.by("createdAt").descending();
            default -> Sort.unsorted();
        };
    }

    private boolean isExplicitSort(String sort) {
        return sort != null && !sort.isBlank() && !"relevance".equalsIgnoreCase(sort);
    }

    private List<String> tokenize(String value) {
        if (!hasText(value)) return List.of();
        return Arrays.stream(value.split("[^a-z0-9]+"))
                .filter(term -> term.length() >= 2)
                .distinct()
                .toList();
    }

    private String normalize(String value) {
        return value == null ? "" : value.toLowerCase(Locale.ROOT).trim().replaceAll("\\s+", " ");
    }

    private String normalizeDisplay(String value) {
        return value == null ? "" : value.trim().replaceAll("\\s+", " ");
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private String exactRegex(String value) {
        return "^" + Pattern.quote(value.trim()) + "$";
    }

    private record ScoredProduct(Product product, int score) {}
}
