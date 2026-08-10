package com.marketplace.dto.response;

import com.marketplace.enums.Role;
import com.marketplace.model.Address;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

/**
 * FIX C-3: Safe projection of the User entity for API responses.
 *
 * The raw User document contains password (BCrypt hash), referredBy, and other
 * internal fields that must never be exposed to API consumers — including admins.
 * AdminService.getAllUsers() previously returned PagedResponse<User> directly,
 * which serialised the password hash into every response.
 *
 * This DTO intentionally omits:
 *   - password    (BCrypt hash — credential leak)
 *   - referredBy  (internal referral tracking ID)
 */
@Data
@Builder
public class UserResponse {
    private String          id;
    private String          name;
    private String          email;
    private Role            role;
    private String          referralCode;
    private List<Address>   addresses;
    private boolean         isActive;
    private LocalDateTime   createdAt;
    private LocalDateTime   updatedAt;
}
