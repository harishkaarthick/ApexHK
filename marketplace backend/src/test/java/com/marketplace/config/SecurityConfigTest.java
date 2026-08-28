package com.marketplace.config;

import com.marketplace.security.AuthRateLimitFilter;
import com.marketplace.security.JwtAuthFilter;
import com.marketplace.security.JwtAuthenticationEntryPoint;
import com.marketplace.security.UserDetailsServiceImpl;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;

class SecurityConfigTest {

    @Test
    void productionCorsMissingConfigurationFailsClosed() {
        SecurityConfig config = config("", true);

        assertThatThrownBy(config::corsConfigurationSource)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("APP_CORS_ALLOWED_ORIGINS must be configured");
    }

    @Test
    void wildcardCorsOriginIsRejectedWhenCredentialsAreEnabled() {
        SecurityConfig config = config("*", true);

        assertThatThrownBy(config::corsConfigurationSource)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Wildcard CORS origins are not allowed");
    }

    private SecurityConfig config(String allowedOrigins, boolean requireExplicitCorsConfig) {
        SecurityConfig config = new SecurityConfig(
                mock(JwtAuthFilter.class),
                mock(UserDetailsServiceImpl.class),
                mock(JwtAuthenticationEntryPoint.class),
                mock(AuthRateLimitFilter.class));
        ReflectionTestUtils.setField(config, "allowedOriginsRaw", allowedOrigins);
        ReflectionTestUtils.setField(config, "requireExplicitCorsConfig", requireExplicitCorsConfig);
        return config;
    }
}
