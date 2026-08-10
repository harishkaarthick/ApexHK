package com.marketplace.repository;

import com.marketplace.enums.BannerPlacement;
import com.marketplace.model.Banner;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface BannerRepository extends MongoRepository<Banner, String> {

    /**
     * FIX 3e: The previous method — findByIsActiveTrueOrderByDisplayOrderAsc() —
     * returned every active banner regardless of expiresAt, so banners past their
     * expiry date stayed publicly visible indefinitely.
     *
     * This query enforces two rules:
     *   1. isActive must be true.
     *   2. expiresAt must be either null/absent (no expiry = permanent banner)
     *      or in the future.
     *
     * MongoDB's { 'expiresAt': null } matches both an explicit null value and a
     * missing field, so banners created without an expiry date are always included.
     */
    @Query(value = "{ 'isActive': true, '$or': ["
                 +     "{ 'expiresAt': null },"
                 +     "{ 'expiresAt': { '$gt': ?0 } }"
                 + "]}",
           sort  = "{ 'displayOrder': 1 }")
    List<Banner> findActiveNonExpired(LocalDateTime now);

    /** Same rules as findActiveNonExpired(), scoped to a single placement
     *  (e.g. only CATEGORY banners, or only HOME banners). */
    @Query(value = "{ 'isActive': true, 'placement': ?1, '$or': [" +
                 "    { 'expiresAt': null }," +
                 "    { 'expiresAt': { '$gt': ?0 } }" +
                 "]}",
           sort  = "{ 'displayOrder': 1 }")
    List<Banner> findActiveNonExpiredByPlacement(LocalDateTime now, BannerPlacement placement);
}