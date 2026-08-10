package com.marketplace.service;

import com.marketplace.dto.request.UserRequest;
import com.marketplace.dto.response.UserResponse;
import com.marketplace.exception.*;
import com.marketplace.model.*;
import com.marketplace.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository  userRepository;
    private final PasswordEncoder passwordEncoder;

    public User getById(String userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId));
    }

    // ISSUE-02 FIX: Return UserResponse (safe projection) instead of raw User entity.
    // All UserController endpoints use these response-returning variants so that
    // the BCrypt password hash is never serialised into an API response.

    public UserResponse getMeResponse(String userId) {
        return toUserResponse(getById(userId));
    }

    public UserResponse updateProfileResponse(String userId, UserRequest.UpdateProfile req) {
        return toUserResponse(updateProfile(userId, req));
    }

    public UserResponse addAddressResponse(String userId, UserRequest.AddAddress req) {
        return toUserResponse(addAddress(userId, req));
    }

    public UserResponse removeAddressResponse(String userId, String addressId) {
        return toUserResponse(removeAddress(userId, addressId));
    }

    public UserResponse setDefaultAddressResponse(String userId, String addressId) {
        return toUserResponse(setDefaultAddress(userId, addressId));
    }

    public User updateProfile(String userId, UserRequest.UpdateProfile req) {
        User user = getById(userId);
        if (req.getName() != null) user.setName(req.getName());
        return userRepository.save(user);
    }

    public void changePassword(String userId, UserRequest.ChangePassword req) {
        User user = getById(userId);
        if (!passwordEncoder.matches(req.getCurrentPassword(), user.getPassword()))
            throw new IllegalArgumentException("Current password is incorrect");
        user.setPassword(passwordEncoder.encode(req.getNewPassword()));
        userRepository.save(user);
    }

    public User addAddress(String userId, UserRequest.AddAddress req) {
        User user = getById(userId);
        Address address = Address.builder()
                .id(UUID.randomUUID().toString())
                .fullName(req.getFullName())
                .phone(req.getPhone())
                .addressLine1(req.getAddressLine1())
                .addressLine2(req.getAddressLine2())
                .city(req.getCity())
                .state(req.getState())
                .pincode(req.getPincode())
                .country(req.getCountry())
                .isDefault(req.isDefault())
                .build();

        if (req.isDefault()) {
            user.getAddresses().forEach(a -> a.setDefault(false));
        }
        user.getAddresses().add(address);
        return userRepository.save(user);
    }

    public User removeAddress(String userId, String addressId) {
        User user = getById(userId);
        user.getAddresses().removeIf(a -> a.getId().equals(addressId));
        return userRepository.save(user);
    }

    public User setDefaultAddress(String userId, String addressId) {
        User user = getById(userId);
        user.getAddresses().forEach(a -> a.setDefault(a.getId().equals(addressId)));
        return userRepository.save(user);
    }

    public User getByEmail(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User", email));
    }

    /**
     * L-8: Fetches only the user's name using a field projection.
     * Avoids loading the full User document (including the BCrypt password hash)
     * when callers only need a display name.
     */
    public String getUserName(String userId) {
        return userRepository.findNameById(userId)
                .map(User::getName)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId));
    }

    private UserResponse toUserResponse(User u) {
        return UserResponse.builder()
                .id(u.getId())
                .name(u.getName())
                .email(u.getEmail())
                .role(u.getRole())
                .referralCode(u.getReferralCode())
                .addresses(u.getAddresses())
                .isActive(u.isActive())
                .createdAt(u.getCreatedAt())
                .updatedAt(u.getUpdatedAt())
                .build();
    }
}