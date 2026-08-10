package com.marketplace.dto.response;

import lombok.*;

public class AuthResponse {

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class TokenPair {
        private String accessToken;
        private String refreshToken;
        private String tokenType;
        private long   expiresIn;
        private UserInfo user;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class UserInfo {
        private String id;
        private String name;
        private String email;
        private String role;
        private String vendorId;
    }
}