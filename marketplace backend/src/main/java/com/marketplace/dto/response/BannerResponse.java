package com.marketplace.dto.response;

import com.marketplace.enums.BannerPlacement;
import lombok.*;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BannerResponse {
    private String id;
    private String title;
    private String imageUrl;
    private String linkUrl;
    private String description;
    private boolean isActive;
    private int displayOrder;
    private LocalDateTime createdAt;
    private LocalDateTime expiresAt;
    private BannerPlacement placement;
}