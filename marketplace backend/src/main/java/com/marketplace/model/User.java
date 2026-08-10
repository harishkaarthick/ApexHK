package com.marketplace.model;

import com.marketplace.enums.Role;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "users")
public class User {

    @Id
    private String id;
    private String name;

    @Indexed(unique = true)
    private String email;

    private String password;
    private Role role;

    @Indexed(unique = true, sparse = true)
    private String referralCode;

    private String referredBy;

    @Builder.Default
    private List<Address> addresses = new ArrayList<>();

    // Accounts start inactive until the user clicks the verification link.
    // UserDetailsServiceImpl rejects login attempts while isActive == false.
    @Builder.Default
    private boolean isActive = true;

    // ISSUE-16 FIX: two new fields required by the email-verification flow.
    //
    // emailVerified  — true once the user has clicked the link in their inbox.
    //                  Checked in AuthService.login() to block login for
    //                  unverified accounts with a clear error message.
    //
    // emailVerificationToken — one-time UUID written at registration and cleared
    //                          on verification. Indexed sparsely so the lookup in
    //                          AuthService.verifyEmail() is O(log n).
    @Builder.Default
    private boolean emailVerified = false;

    @Indexed(unique = true, sparse = true)  // sparse: null for already-verified users
    private String emailVerificationToken;

    @CreatedDate
    private LocalDateTime createdAt;

    @LastModifiedDate
    private LocalDateTime updatedAt;
}