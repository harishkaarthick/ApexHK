package com.marketplace.config;

import com.marketplace.security.JwtUtil;

import org.springframework.beans.factory.annotation.Value;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.authorization.AuthorizationDeniedException;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.util.StringUtils;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

import java.util.Arrays;
import java.util.List;

@Slf4j
@Configuration
@EnableWebSocketMessageBroker
@RequiredArgsConstructor
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final JwtUtil jwtUtil;
    // ISSUE-03 FIX: Inject RedisTemplate to check JWT blacklist on WebSocket handshake.
    private final RedisTemplate<String, Object> redisTemplate;

    @Value("${app.cors.allowed-origins:http://localhost:3000,http://localhost:5173}")
    private String allowedOriginsRaw;

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        String[] origins = Arrays.stream(allowedOriginsRaw.split(","))
                .map(String::trim)
                .toArray(String[]::new);
        registry.addEndpoint("/ws").setAllowedOriginPatterns(origins).withSockJS();
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.enableSimpleBroker("/topic", "/queue");
        registry.setApplicationDestinationPrefixes("/app");
        registry.setUserDestinationPrefix("/user");
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(new ChannelInterceptor() {
            @Override
            public Message<?> preSend(Message<?> message, MessageChannel channel) {
                StompHeaderAccessor accessor =
                        MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);

                if (accessor != null && StompCommand.CONNECT.equals(accessor.getCommand())) {
                    String authHeader = accessor.getFirstNativeHeader("Authorization");
                    if (!StringUtils.hasText(authHeader) || !authHeader.startsWith("Bearer ")) {
                        throw new AuthenticationCredentialsNotFoundException("Missing WebSocket bearer token");
                    }
                    String token = authHeader.substring(7);
                    if (!jwtUtil.validateToken(token) || isTokenBlacklisted(token)) {
                        throw new AuthenticationCredentialsNotFoundException("Invalid WebSocket bearer token");
                    }

                    // ISSUE-03 FIX: Only allow connection if token is NOT blacklisted.
                    // Previously a logged-out token could still open a WebSocket connection
                    // for up to 15 minutes (JWT expiry) because the blacklist was not checked.
                    String role   = jwtUtil.extractRole(token);
                    String userId = jwtUtil.extractUserId(token);
                    UsernamePasswordAuthenticationToken auth =
                            new UsernamePasswordAuthenticationToken(
                                    userId, null,
                                    List.of(new SimpleGrantedAuthority("ROLE_" + role)));
                    accessor.setUser(auth);
                    if (accessor.getSessionAttributes() != null) {
                        accessor.getSessionAttributes().put("userId", userId);
                    }
                }

                if (accessor != null && StompCommand.SUBSCRIBE.equals(accessor.getCommand())) {
                    String destination = accessor.getDestination();
                    if (destination != null && destination.startsWith("/user/")
                            && SimpMessageHeaderAccessor.getUser(message.getHeaders()) == null) {
                        throw new AuthorizationDeniedException("WebSocket subscription denied");
                    }
                }
                return message;
            }
        });
    }

    /**
     * ISSUE-03 FIX: Mirrors JwtAuthFilter.isTokenBlacklisted().
     * Fail-closed: treats token as blacklisted if Redis is unavailable.
     */
    private boolean isTokenBlacklisted(String token) {
        try {
            return Boolean.TRUE.equals(redisTemplate.hasKey("blacklist:" + token));
        } catch (Exception e) {
            log.error("Redis unavailable during WebSocket blacklist check — denying token: {}", e.getMessage());
            return true; // fail-closed
        }
    }
}
