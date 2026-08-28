package com.marketplace.config;

import com.marketplace.security.AuthRateLimitFilter;
import com.marketplace.security.JwtAuthFilter;
import com.marketplace.security.JwtAuthenticationEntryPoint;
import com.marketplace.security.UserDetailsServiceImpl;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.*;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.*;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.util.StringUtils;
import org.springframework.web.cors.*;

import java.util.Arrays;
import java.util.List;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;
    private final UserDetailsServiceImpl userDetailsService;
    private final JwtAuthenticationEntryPoint authEntryPoint;
    private final AuthRateLimitFilter authRateLimitFilter;

    @Value("${app.cors.allowed-origins:http://localhost:3000,http://localhost:5173}")
    private String allowedOriginsRaw;

    private static final String[] PUBLIC_POST = {
            "/api/auth/register",
            "/api/auth/login",
            "/api/auth/refresh-token",

            // Razorpay webhook is server-to-server; no user JWT,
            // but signature-verified inside PaymentWebhookController.
            "/api/payments/webhook"
    };

    private static final String[] PUBLIC_GET = {
            "/api/products/**",
            "/api/reviews/**",
            "/api/public/**",
            "/api/categories",
            "/swagger-ui/**",
            "/swagger-ui.html",
            "/api-docs/**",
            "/actuator/health",

            // ISSUE-16 FIX: the email-verification endpoint must be publicly
            // accessible because the user has no JWT at the time they click
            // the link — tokens are only issued after a successful login,
            // and login requires a verified account.
            "/api/auth/verify-email"
    };

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {

        http
                .csrf(AbstractHttpConfigurer::disable)

                .cors(cors -> cors.configurationSource(corsConfigurationSource()))

                .sessionManagement(s ->
                        s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))

                .exceptionHandling(ex ->
                        ex.authenticationEntryPoint(authEntryPoint))

                .authorizeHttpRequests(auth -> auth

                        // Allow browser CORS preflight requests.
                        // This is required before the browser sends
                        // POST /api/auth/login from the deployed frontend.
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()

                        // Public POST endpoints
                        .requestMatchers(HttpMethod.POST, PUBLIC_POST).permitAll()

                        // Review endpoint
                        .requestMatchers(
                                HttpMethod.GET,
                                "/api/reviews/mine/**"
                        ).hasRole("CUSTOMER")

                        // Public GET endpoints
                        .requestMatchers(
                                HttpMethod.GET,
                                PUBLIC_GET
                        ).permitAll()

                        // WebSocket
                        .requestMatchers("/ws/**").permitAll()

                        // Customer-only
                        .requestMatchers("/api/cart/**")
                        .hasRole("CUSTOMER")

                        .requestMatchers("/api/coupons/**")
                        .hasRole("CUSTOMER")

                        .requestMatchers(
                                HttpMethod.POST,
                                "/api/orders/checkout"
                        ).hasRole("CUSTOMER")

                        .requestMatchers(
                                HttpMethod.POST,
                                "/api/orders/verify-payment"
                        ).hasRole("CUSTOMER")

                        .requestMatchers("/api/orders/my-orders")
                        .hasRole("CUSTOMER")

                        .requestMatchers(
                                HttpMethod.GET,
                                "/api/orders/*/delivery-otp"
                        ).hasRole("CUSTOMER")

                        .requestMatchers(
                                HttpMethod.POST,
                                "/api/returns"
                        ).hasRole("CUSTOMER")

                        .requestMatchers(
                                HttpMethod.POST,
                                "/api/orders/*/cancel"
                        ).hasRole("CUSTOMER")

                        // Vendor-only
                        .requestMatchers("/api/vendor/**")
                        .hasRole("VENDOR")

                        .requestMatchers(
                                HttpMethod.POST,
                                "/api/categories/request"
                        ).hasRole("VENDOR")

                        .requestMatchers(
                                HttpMethod.POST,
                                "/api/products"
                        ).hasRole("VENDOR")

                        .requestMatchers(
                                HttpMethod.PUT,
                                "/api/products/**"
                        ).hasRole("VENDOR")

                        .requestMatchers(
                                HttpMethod.DELETE,
                                "/api/products/**"
                        ).hasRole("VENDOR")

                        // Admin-only
                        .requestMatchers("/api/admin/**")
                        .hasRole("ADMIN")

                        // Shared
                        .requestMatchers("/api/wallet/**")
                        .hasAnyRole("CUSTOMER", "VENDOR")

                        // Authenticated
                        .requestMatchers("/api/notifications/**")
                        .authenticated()

                        .requestMatchers(
                                HttpMethod.PUT,
                                "/api/orders/*/status",
                                "/api/orders/*/tracking"
                        ).hasRole("VENDOR")

                        .requestMatchers("/api/orders/**")
                        .authenticated()

                        .requestMatchers("/api/returns/**")
                        .authenticated()

                        .requestMatchers("/api/users/**")
                        .authenticated()

                        // Everything else requires authentication
                        .anyRequest()
                        .authenticated()
                )

                .authenticationProvider(authenticationProvider())

                .addFilterBefore(
                        authRateLimitFilter,
                        UsernamePasswordAuthenticationFilter.class
                )

                .addFilterBefore(
                        jwtAuthFilter,
                        UsernamePasswordAuthenticationFilter.class
                );

        return http.build();
    }

    @Bean
    public AuthenticationProvider authenticationProvider() {

        DaoAuthenticationProvider p =
                new DaoAuthenticationProvider();

        p.setUserDetailsService(userDetailsService);
        p.setPasswordEncoder(passwordEncoder());

        return p;
    }

    @Bean
    public AuthenticationManager authenticationManager(
            AuthenticationConfiguration cfg
    ) throws Exception {

        return cfg.getAuthenticationManager();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {

        return new BCryptPasswordEncoder(12);
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {

        CorsConfiguration config = new CorsConfiguration();

        List<String> origins =
                StringUtils.hasText(allowedOriginsRaw)
                        ? Arrays.asList(allowedOriginsRaw.split(","))
                        : List.of("http://localhost:3000");

        config.setAllowedOrigins(
                origins.stream()
                        .map(String::trim)
                        .toList()
        );

        config.setAllowedMethods(
                List.of(
                        "GET",
                        "POST",
                        "PUT",
                        "PATCH",
                        "DELETE",
                        "OPTIONS"
                )
        );

        config.setAllowedHeaders(
                List.of("*")
        );

        config.setAllowCredentials(true);

        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source =
                new UrlBasedCorsConfigurationSource();

        source.registerCorsConfiguration(
                "/**",
                config
        );

        return source;
    }
}
