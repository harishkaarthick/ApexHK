package com.marketplace.service;

import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class ProductSearchSynonymService {

    private final Map<String, List<String>> synonyms;

    public ProductSearchSynonymService() {
        Map<String, List<String>> terms = new HashMap<>();
        addGroup(terms, "face wash", "cleanser", "facial cleanser", "face cleanser");
        addGroup(terms, "mobile", "smartphone", "phone");
        addGroup(terms, "shoes", "footwear", "sneakers", "trainers");
        addGroup(terms, "tshirt", "t-shirt", "tee");
        this.synonyms = Collections.unmodifiableMap(terms);
    }

    public List<String> expand(List<String> normalizedTerms) {
        LinkedHashSet<String> expanded = new LinkedHashSet<>(normalizedTerms);
        String phrase = String.join(" ", normalizedTerms);
        addMatches(expanded, phrase);
        normalizedTerms.forEach(term -> addMatches(expanded, term));
        return expanded.stream().filter(term -> term.length() >= 2).toList();
    }

    private void addMatches(Set<String> expanded, String term) {
        List<String> matches = synonyms.get(term);
        if (matches != null) {
            expanded.addAll(matches);
        }
    }

    private void addGroup(Map<String, List<String>> terms, String... values) {
        for (String value : values) {
            List<String> others = Arrays.stream(values)
                    .filter(other -> !other.equalsIgnoreCase(value))
                    .map(this::normalize)
                    .distinct()
                    .toList();
            terms.put(normalize(value), others);
        }
    }

    private String normalize(String value) {
        return value == null ? "" : value.toLowerCase(Locale.ROOT).trim().replaceAll("\\s+", " ");
    }
}
