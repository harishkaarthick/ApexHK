package com.marketplace.dto.request;

import jakarta.validation.constraints.*;
import lombok.Data;

public class UserRequest {

    @Data
    public static class UpdateProfile {
        private String name;
    }

    @Data
    public static class ChangePassword {
        @NotBlank private String currentPassword;
        @NotBlank @Size(min = 8) private String newPassword;
    }

    @Data
    public static class AddAddress {
        @NotBlank private String fullName;
        @NotBlank private String phone;
        @NotBlank private String addressLine1;
        private  String addressLine2;
        @NotBlank private String city;
        @NotBlank private String state;
        @NotBlank private String pincode;
        @NotBlank private String country;
        private  boolean isDefault;
    }
}