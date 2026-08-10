package com.marketplace.dto.request;

import com.marketplace.enums.BannerPlacement;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.time.LocalDateTime;

public class BannerRequest {

    @Data
    public static class Create {
        @NotBlank private String title;
        private   String linkUrl;
        private   String description;
        private   boolean active = true;
        private   int displayOrder;
        private   LocalDateTime expiresAt;
        // Which section of the storefront this banner appears in.
        // Defaults to HOME (top hero banner) to preserve existing behaviour
        // for admins who don't pick a placement.
        private   BannerPlacement placement = BannerPlacement.HOME;
    }
}