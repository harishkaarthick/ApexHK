package com.marketplace.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.env.Environment;
import org.springframework.data.redis.connection.RedisConnection;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.util.Arrays;

@Slf4j
@Component
@RequiredArgsConstructor
public class RedisStartupValidator {

    private final Environment env;
    private final RedisConnectionFactory redisConnectionFactory;

    @EventListener(ApplicationReadyEvent.class)
    public void validateRedisConnection() {
        boolean runningOnRender = StringUtils.hasText(env.getProperty("RENDER"))
                || StringUtils.hasText(env.getProperty("RENDER_SERVICE_ID"));
        boolean productionProfile = Arrays.stream(env.getActiveProfiles())
                .anyMatch(profile -> profile.equalsIgnoreCase("prod")
                        || profile.equalsIgnoreCase("production"));
        boolean requireExplicitRedis = env.getProperty(
                "app.redis.require-explicit-config", Boolean.class, false);

        String redisHost = env.getProperty("spring.data.redis.host");
        boolean usingDefaultLocalhost = !StringUtils.hasText(redisHost)
                || "localhost".equalsIgnoreCase(redisHost)
                || "127.0.0.1".equals(redisHost);

        if ((runningOnRender || productionProfile || requireExplicitRedis) && usingDefaultLocalhost) {
            throw new IllegalStateException(
                    "Redis/Valkey configuration is missing for production. Set REDIS_HOST "
                            + "to the Render Internal Key Value host and REDIS_PORT to its port.");
        }

        try (RedisConnection connection = redisConnectionFactory.getConnection()) {
            String pong = connection.ping();
            log.info("Redis/Valkey connection successful: host={}, ping={}", redisHost, pong);
        } catch (Exception e) {
            log.error("Redis/Valkey connection failed: {}", e.getMessage());
            if (runningOnRender || productionProfile || requireExplicitRedis) {
                throw new IllegalStateException(
                        "Redis/Valkey connection failed in production configuration", e);
            }
        }
    }
}
