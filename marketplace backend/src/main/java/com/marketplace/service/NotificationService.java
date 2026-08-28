package com.marketplace.service;

import com.marketplace.dto.response.NotificationResponse;
import com.marketplace.dto.response.PagedResponse;
import com.marketplace.exception.ResourceNotFoundException;
import com.marketplace.exception.UnauthorizedException;
import com.marketplace.model.Notification;
import com.marketplace.repository.NotificationRepository;
import com.marketplace.util.PaginationUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.*;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

import java.util.List;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final SimpMessagingTemplate  messagingTemplate;
    private final MongoTemplate          mongoTemplate;   // ← add this

    @Async
    public void send(String userId, String title, String message,
                     String type, String referenceId) {
        Notification n = Notification.builder()
                .userId(userId)
                .title(title)
                .message(message)
                .type(type)
                .referenceId(referenceId)
                .build();
        notificationRepository.save(n);
        messagingTemplate.convertAndSendToUser(
                userId, "/queue/notifications", toResponse(n));
    }

    public PagedResponse<NotificationResponse> getMyNotifications(
            String userId, int page, int size) {
        Pageable pageable = PaginationUtils.page(page, size);
        Page<Notification> p =
                notificationRepository.findByUserIdOrderByCreatedAtDesc(userId, pageable);
        return PagedResponse.of(p.map(this::toResponse));
    }

    public long countUnread(String userId) {
        return notificationRepository.countByUserIdAndIsReadFalse(userId);
    }

    public void markAllRead(String userId) {
    Query query = Query.query(
            Criteria.where("userId").is(userId).and("isRead").is(false));
    Update update = new Update().set("isRead", true);
    mongoTemplate.updateMulti(query, update, Notification.class);
}

    public void markRead(String notificationId, String userId) {
        Notification n = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new ResourceNotFoundException("Notification", notificationId));
        if (!n.getUserId().equals(userId))
            throw new UnauthorizedException("Not your notification");
        n.setRead(true);
        notificationRepository.save(n);
    }

    private NotificationResponse toResponse(Notification n) {
        return NotificationResponse.builder()
                .id(n.getId())
                .userId(n.getUserId())
                .title(n.getTitle())
                .message(n.getMessage())
                .type(n.getType())
                .referenceId(n.getReferenceId())
                .isRead(n.isRead())
                .createdAt(n.getCreatedAt())
                .build();
    }
}
