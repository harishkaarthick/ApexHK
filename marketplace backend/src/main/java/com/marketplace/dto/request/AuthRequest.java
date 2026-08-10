package com.marketplace.dto.request;

import com.marketplace.enums.Role;
import jakarta.validation.constraints.*;
import lombok.Data;

public class AuthRequest {

    @Data
    public static class Register {
        @NotBlank private String name;
        @NotBlank @Email private String email;
        @NotBlank @Size(min = 8) private String password;
        @NotNull  private Role role;
        private String referralCode;
        private String storeName;
        private String storeDescription;
    }

    @Data
    public static class Login {
        @NotBlank @Email private String email;
        @NotBlank private String password;
    }

    @Data
    public static class RefreshToken {
        @NotBlank private String refreshToken;
    }

    @Data
    public static class Logout {
        @NotBlank private String refreshToken;
    }
}