package com.marketplace.security;

import com.marketplace.enums.Role;
import com.marketplace.model.User;
import com.marketplace.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.*;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class UserDetailsServiceImpl implements UserDetailsService {

    private final UserRepository userRepository;

    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + email));

        /*
         * CHANGE — Differentiate the isActive check by role.
         *
         * Previously ALL users with isActive=false were rejected here with
         * UsernameNotFoundException.  Spring Security's DaoAuthenticationProvider
         * hides UsernameNotFoundException by default (hideUserNotFoundExceptions=true),
         * converting it to a generic BadCredentialsException.  The caller receives
         * "Invalid email or password" with no indication of WHY the login failed.
         *
         * For CUSTOMER / ADMIN this is the correct and secure behaviour — a
         * deactivated account should not leak its status to the caller.
         *
         * For VENDOR this caused a UX regression: a vendor with a PENDING store
         * (isActive=false) hit this rejection BEFORE AuthService.login() could
         * reach its vendor-status check, so the required message
         * "Your vendor account is awaiting admin approval." was never returned.
         *
         * Fix:
         *   - Non-VENDOR with isActive=false  →  still rejected here (unchanged).
         *   - VENDOR with isActive=false       →  allowed through so that
         *     AuthService.login() can evaluate Vendor.status and return the
         *     appropriate AccountNotReadyException with a meaningful message.
         *
         * BCrypt password verification still happens inside DaoAuthenticationProvider
         * regardless of this change — a vendor with the wrong password will still
         * get "Invalid email or password".  Only a vendor with the correct password
         * but a non-APPROVED store status proceeds far enough to see the approval
         * message.
         */
        if (!user.isActive() && user.getRole() != Role.VENDOR) {
            throw new UsernameNotFoundException("Account is deactivated: " + email);
        }

        return org.springframework.security.core.userdetails.User.builder()
                .username(user.getEmail())
                .password(user.getPassword())
                .authorities(List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole().name())))
                .build();
    }
}