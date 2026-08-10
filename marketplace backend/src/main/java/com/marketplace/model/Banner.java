package com.marketplace.model;

import com.marketplace.enums.BannerPlacement;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "banners")
public class Banner {

    @Id
    private String id;

    private String title;
    private String imageUrl;
    private String linkUrl;
    private String description;

    @Builder.Default
    private boolean isActive = true;

    private int displayOrder;

    /** Where on the storefront this banner should render. Defaults to HOME
     *  so existing banners (created before this field existed) keep behaving
     *  exactly as they do today. */
    @Builder.Default
    private BannerPlacement placement = BannerPlacement.HOME;

    @CreatedDate
    private LocalDateTime createdAt;

    private LocalDateTime expiresAt;
}