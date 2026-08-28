package com.marketplace.security;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class JwtAuthFilterTest {

    private static final String SECRET = "test-jwt-secret-that-is-long-enough-for-hs512";

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void validJwtWithRedisAvailableCreatesSecurityContextAuthentication() throws Exception {
        JwtUtil jwtUtil = jwtUtil(900000);
        RedisTemplate<String, Object> redisTemplate = redisTemplate(false);
        UserDetailsServiceImpl userDetailsService = userDetailsService();
        JwtAuthFilter filter = new JwtAuthFilter(jwtUtil, userDetailsService, redisTemplate);

        filter.doFilter(request(jwtUtil.generateAccessToken(
                        "user-1", "customer@example.com", "CUSTOMER", null)),
                new MockHttpServletResponse(), new MockFilterChain());

        assertNotNull(SecurityContextHolder.getContext().getAuthentication());
        verify(userDetailsService).loadUserByUsername("customer@example.com");
    }

    @Test
    void invalidJwtDoesNotLoadUserOrAuthenticate() throws Exception {
        JwtUtil jwtUtil = jwtUtil(900000);
        RedisTemplate<String, Object> redisTemplate = redisTemplate(false);
        UserDetailsServiceImpl userDetailsService = userDetailsService();
        JwtAuthFilter filter = new JwtAuthFilter(jwtUtil, userDetailsService, redisTemplate);

        filter.doFilter(request("not-a-jwt"), new MockHttpServletResponse(), new MockFilterChain());

        assertNull(SecurityContextHolder.getContext().getAuthentication());
        verify(userDetailsService, never()).loadUserByUsername(anyString());
    }

    @Test
    void expiredJwtDoesNotLoadUserOrAuthenticate() throws Exception {
        JwtUtil expiredJwtUtil = jwtUtil(-1000);
        String expiredToken = expiredJwtUtil.generateAccessToken(
                "user-1", "customer@example.com", "CUSTOMER", null);
        JwtUtil validatingJwtUtil = jwtUtil(900000);
        RedisTemplate<String, Object> redisTemplate = redisTemplate(false);
        UserDetailsServiceImpl userDetailsService = userDetailsService();
        JwtAuthFilter filter = new JwtAuthFilter(validatingJwtUtil, userDetailsService, redisTemplate);

        filter.doFilter(request(expiredToken), new MockHttpServletResponse(), new MockFilterChain());

        assertNull(SecurityContextHolder.getContext().getAuthentication());
        verify(userDetailsService, never()).loadUserByUsername(anyString());
    }

    @Test
    void blacklistedJwtDoesNotAuthenticate() throws Exception {
        JwtUtil jwtUtil = jwtUtil(900000);
        RedisTemplate<String, Object> redisTemplate = redisTemplate(true);
        UserDetailsServiceImpl userDetailsService = userDetailsService();
        JwtAuthFilter filter = new JwtAuthFilter(jwtUtil, userDetailsService, redisTemplate);

        filter.doFilter(request(jwtUtil.generateAccessToken(
                        "user-1", "customer@example.com", "CUSTOMER", null)),
                new MockHttpServletResponse(), new MockFilterChain());

        assertNull(SecurityContextHolder.getContext().getAuthentication());
        verify(userDetailsService, never()).loadUserByUsername(anyString());
    }

    @Test
    void redisUnavailableFailsClosedAndDoesNotAuthenticate() throws Exception {
        JwtUtil jwtUtil = jwtUtil(900000);
        RedisTemplate<String, Object> redisTemplate = mock(RedisTemplate.class);
        when(redisTemplate.hasKey(anyString()))
                .thenThrow(new RedisConnectionFailureException("redis unavailable"));
        UserDetailsServiceImpl userDetailsService = userDetailsService();
        JwtAuthFilter filter = new JwtAuthFilter(jwtUtil, userDetailsService, redisTemplate);

        filter.doFilter(request(jwtUtil.generateAccessToken(
                        "user-1", "customer@example.com", "CUSTOMER", null)),
                new MockHttpServletResponse(), new MockFilterChain());

        assertNull(SecurityContextHolder.getContext().getAuthentication());
        verify(userDetailsService, never()).loadUserByUsername(anyString());
    }

    private JwtUtil jwtUtil(long accessExpiry) {
        JwtUtil jwtUtil = new JwtUtil();
        ReflectionTestUtils.setField(jwtUtil, "secret", SECRET);
        ReflectionTestUtils.setField(jwtUtil, "accessExpiry", accessExpiry);
        ReflectionTestUtils.setField(jwtUtil, "refreshExpiry", 604800000L);
        jwtUtil.init();
        return jwtUtil;
    }

    @SuppressWarnings("unchecked")
    private RedisTemplate<String, Object> redisTemplate(boolean blacklisted) {
        RedisTemplate<String, Object> redisTemplate = mock(RedisTemplate.class);
        when(redisTemplate.hasKey(anyString())).thenReturn(blacklisted);
        return redisTemplate;
    }

    private UserDetailsServiceImpl userDetailsService() {
        UserDetailsServiceImpl userDetailsService = mock(UserDetailsServiceImpl.class);
        UserDetails userDetails = new User(
                "customer@example.com",
                "password",
                List.of(new SimpleGrantedAuthority("ROLE_CUSTOMER")));
        when(userDetailsService.loadUserByUsername("customer@example.com"))
                .thenReturn(userDetails);
        return userDetailsService;
    }

    private MockHttpServletRequest request(String token) {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/users/me");
        request.addHeader("Authorization", "Bearer " + token);
        return request;
    }
}
