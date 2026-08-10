package com.marketplace.controller;

import com.marketplace.dto.response.ApiResponse;
import com.marketplace.security.SecurityUtil;
import com.marketplace.service.NotificationService;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
@Tag(name = "Notifications")
public class NotificationController {

    private final NotificationService notificationService;

    @GetMapping
    public ResponseEntity<?> list(@RequestParam(defaultValue = "0") int page,
                                  @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.ok(notificationService.getMyNotifications(SecurityUtil.currentUserId(), page, size));
    }

    @GetMapping("/unread-count")
    public ResponseEntity<?> unreadCount() {
        return ApiResponse.ok(notificationService.countUnread(SecurityUtil.currentUserId()));
    }

    @PutMapping("/read-all")
    public ResponseEntity<?> readAll() {
        notificationService.markAllRead(SecurityUtil.currentUserId());
        return ApiResponse.noContent("All marked as read");
    }

    @PutMapping("/{id}/read")
    public ResponseEntity<?> read(@PathVariable String id) {
        notificationService.markRead(id, SecurityUtil.currentUserId());
        return ApiResponse.noContent("Marked as read");
    }
}