package com.marketplace.dto.response;

import lombok.*;
import java.time.LocalDateTime;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class NotificationResponse {
    private String id;
    private String userId;
    private String title;
    private String message;
    private String type;
    private String referenceId;
    private boolean isRead;
    private LocalDateTime createdAt;
}
