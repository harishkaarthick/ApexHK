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

import java.net.URI;
import java.net.URISyntaxException;
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
        boolean strictRedis = runningOnRender || productionProfile || requireExplicitRedis;

        RedisTarget target = resolveRedisTarget();

        log.info("Redis/Valkey configuration: source={}, host={}, port={}, authenticationEnabled={}",
                target.source(), target.safeHost(), target.portForLog(), target.authenticationEnabled());

        if (strictRedis && target.localhost()) {
            throw new IllegalStateException(
                    "Redis/Valkey configuration is missing for production. Set REDIS_URL "
                            + "to the Render Internal Key Value URL, or set REDIS_HOST and REDIS_PORT.");
        }

        try (RedisConnection connection = redisConnectionFactory.getConnection()) {
            String pong = connection.ping();
            log.info("Redis/Valkey connection successful: host={}, ping={}", target.safeHost(), pong);
        } catch (Exception e) {
            log.error("Redis/Valkey connection failed: {}", e.getMessage());
            if (strictRedis) {
                throw new IllegalStateException(
                        "Redis/Valkey connection failed in production configuration", e);
            }
        }
    }

    private RedisTarget resolveRedisTarget() {
        String redisUrl = env.getProperty("spring.data.redis.url");
        if (StringUtils.hasText(redisUrl)) {
            return fromUrl(redisUrl);
        }

        String host = env.getProperty("spring.data.redis.host");
        Integer port = env.getProperty("spring.data.redis.port", Integer.class, 6379);
        boolean authEnabled = StringUtils.hasText(env.getProperty("spring.data.redis.password"));
        return new RedisTarget("host/port", host, port, authEnabled);
    }

    private RedisTarget fromUrl(String redisUrl) {
        try {
            URI uri = new URI(redisUrl);
            String scheme = uri.getScheme();
            if (!"redis".equalsIgnoreCase(scheme) && !"rediss".equalsIgnoreCase(scheme)) {
                throw new IllegalStateException(
                        "Redis/Valkey URL must use redis:// or rediss:// scheme");
            }

            String userInfo = uri.getUserInfo();
            boolean authEnabled = StringUtils.hasText(userInfo)
                    && userInfo.contains(":")
                    && StringUtils.hasText(userInfo.substring(userInfo.indexOf(':') + 1));
            int port = uri.getPort() > 0 ? uri.getPort() : 6379;
            return new RedisTarget("url", uri.getHost(), port, authEnabled);
        } catch (URISyntaxException e) {
            throw new IllegalStateException("Redis/Valkey URL is not a valid URI", e);
        }
    }

    private record RedisTarget(String source, String host, Integer port, boolean authenticationEnabled) {

        boolean localhost() {
            return !StringUtils.hasText(host)
                    || "localhost".equalsIgnoreCase(host)
                    || "127.0.0.1".equals(host);
        }

        String safeHost() {
            return StringUtils.hasText(host) ? host : "<missing>";
        }

        String portForLog() {
            return port != null ? port.toString() : "<default>";
        }
    }
}
