package com.marketplace.repository;

import com.marketplace.enums.Role;
import com.marketplace.model.User;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserRepository extends MongoRepository<User, String> {

    Optional<User> findByEmail(String email);

    boolean existsByEmail(String email);

    Optional<User> findByReferralCode(String referralCode);

    long countByRoleAndIsActiveTrue(Role role);

    @Query(value = "{ '_id': ?0 }", fields = "{ 'name': 1 }")
    Optional<User> findNameById(String id);

    // ISSUE-16 FIX: required by AuthService.verifyEmail().
    // The sparse index on User.emailVerificationToken (declared in the model)
    // makes this lookup O(log n).  The token is cleared (set to null) after
    // successful verification, so the index only tracks unverified accounts.
    Optional<User> findByEmailVerificationToken(String token);
}