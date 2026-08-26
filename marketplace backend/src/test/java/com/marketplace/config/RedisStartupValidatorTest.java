package com.marketplace.config;

import org.junit.jupiter.api.Test;
import org.springframework.core.env.Environment;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.data.redis.connection.RedisConnection;
import org.springframework.data.redis.connection.RedisConnectionFactory;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class RedisStartupValidatorTest {

    @Test
    void renderFailsClearlyWhenRedisUrlIsMissingAndHostIsLocalhost() {
        Environment env = new MockEnvironment()
                .withProperty("RENDER", "true")
                .withProperty("spring.data.redis.host", "localhost")
                .withProperty("spring.data.redis.port", "6379")
                .withProperty("app.redis.require-explicit-config", "false");

        RedisStartupValidator validator =
                new RedisStartupValidator(env, mock(RedisConnectionFactory.class));

        assertThrows(IllegalStateException.class, validator::validateRedisConnection);
    }

    @Test
    void renderAcceptsRedisUrlAndVerifiesConnection() {
        Environment env = new MockEnvironment()
                .withProperty("RENDER", "true")
                .withProperty("spring.data.redis.url", "redis://red-example:6379");
        RedisConnectionFactory factory = mock(RedisConnectionFactory.class);
        RedisConnection connection = mock(RedisConnection.class);
        when(factory.getConnection()).thenReturn(connection);
        when(connection.ping()).thenReturn("PONG");

        RedisStartupValidator validator = new RedisStartupValidator(env, factory);

        assertDoesNotThrow(validator::validateRedisConnection);
        verify(connection).ping();
    }

    @Test
    void renderFailsWhenRedisUrlCannotConnect() {
        Environment env = new MockEnvironment()
                .withProperty("RENDER", "true")
                .withProperty("spring.data.redis.url", "redis://red-example:6379");
        RedisConnectionFactory factory = mock(RedisConnectionFactory.class);
        when(factory.getConnection()).thenThrow(new IllegalStateException("connection refused"));

        RedisStartupValidator validator = new RedisStartupValidator(env, factory);

        assertThrows(IllegalStateException.class, validator::validateRedisConnection);
    }

    @Test
    void localConnectionFailureIsObservableButDoesNotFailStartup() {
        Environment env = new MockEnvironment()
                .withProperty("spring.data.redis.host", "localhost")
                .withProperty("spring.data.redis.port", "6379");
        RedisConnectionFactory factory = mock(RedisConnectionFactory.class);
        when(factory.getConnection()).thenThrow(new IllegalStateException("connection refused"));

        RedisStartupValidator validator = new RedisStartupValidator(env, factory);

        assertDoesNotThrow(validator::validateRedisConnection);
    }
}
