package com.marketplace.service;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;

import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class EmailService {

    private static final String BREVO_EMAIL_ENDPOINT = "https://api.brevo.com/v3/smtp/email";

    private final TemplateEngine templateEngine;
    private final RestClient restClient = RestClient.create();

    @Value("${brevo.api-key:}")
    private String brevoApiKey;

    @Value("${mail.from:}")
    private String mailFrom;

    @Value("${mail.from-name:ApexHK}")
    private String mailFromName;

    @PostConstruct
    void logMailConfiguration() {
        log.info("Brevo email configuration loaded: brevoApiKeyConfigured={}, mailFromConfigured={}",
                StringUtils.hasText(brevoApiKey), StringUtils.hasText(mailFrom));
    }

    @Async
    public void sendOrderConfirmation(String to, String customerName,
                                      String orderId, double amount) {
        Context ctx = new Context();
        ctx.setVariable("customerName", customerName);
        ctx.setVariable("orderId",      orderId);
        ctx.setVariable("amount",       amount);
        sendHtml(to, "Order Confirmed – #" + orderId, "order-confirmation", ctx);
    }

    @Async
    public void sendOrderShipped(String to, String customerName,
                                 String orderId, String trackingId) {
        Context ctx = new Context();
        ctx.setVariable("customerName", customerName);
        ctx.setVariable("orderId",      orderId);
        ctx.setVariable("trackingId",   trackingId);
        sendHtml(to, "Your Order Has Shipped – #" + orderId, "order-shipped", ctx);
    }

    @Async
    public void sendOrderDelivered(String to, String customerName, String orderId) {
        Context ctx = new Context();
        ctx.setVariable("customerName", customerName);
        ctx.setVariable("orderId",      orderId);
        sendHtml(to, "Your Order Has Been Delivered - #" + orderId, "order-delivered", ctx);
    }

    @Async
    public void sendOrderCancelled(String to, String customerName, String orderId) {
        Context ctx = new Context();
        ctx.setVariable("customerName", customerName);
        ctx.setVariable("orderId",      orderId);
        sendHtml(to, "Your Order Has Been Cancelled - #" + orderId, "order-cancelled", ctx);
    }

    @Async
    public void sendVendorApplicationReceived(String to, String vendorName, String storeName) {
        Context ctx = new Context();
        ctx.setVariable("vendorName", vendorName);
        ctx.setVariable("storeName",  storeName);
        sendHtml(to, "Vendor Application Received", "vendor-application-received", ctx);
    }

    @Async
    public void sendVendorApproval(String to, String storeName) {
        Context ctx = new Context();
        ctx.setVariable("vendorName", storeName);
        ctx.setVariable("storeName", storeName);
        sendHtml(to, "Your Vendor Account is Approved!", "vendor-approval", ctx);
    }

    @Async
    public void sendVendorRejection(String to, String storeName, String reason) {
        Context ctx = new Context();
        ctx.setVariable("vendorName", storeName);
        ctx.setVariable("storeName", storeName);
        ctx.setVariable("reason",    reason);
        sendHtml(to, "Vendor Application Update", "vendor-rejection", ctx);
    }

    @Async
    public void sendRefundConfirmation(String to, String customerName, double amount) {
        Context ctx = new Context();
        ctx.setVariable("customerName", customerName);
        ctx.setVariable("amount",       amount);
        sendHtml(to, "Refund Processed", "refund-confirmation", ctx);
    }

    @Async
    public void sendDeliveryOtp(String to, String customerName, String orderId, String otp) {
        Context ctx = new Context();
        ctx.setVariable("customerName", customerName);
        ctx.setVariable("orderId",      orderId);
        ctx.setVariable("otp",           otp);
        sendHtml(to, "Your Delivery OTP – #" + orderId, "delivery-otp", ctx);
    }

    @Async
    public void sendOrderOutForDelivery(String to, String customerName,
                                        String orderId, String trackingId) {
        Context ctx = new Context();
        ctx.setVariable("customerName", customerName);
        ctx.setVariable("orderId",      orderId);
        ctx.setVariable("trackingId",   trackingId);
        sendHtml(to, "Your Order is Out for Delivery – #" + orderId, "order-out-for-delivery", ctx);
    }

    /**
     * ISSUE-16 FIX: Send the one-time email-verification link to a newly
     * registered user.
     *
     * Called from AuthService.register() immediately after the User document
     * is persisted.  The link contains the single-use UUID token stored in
     * User.emailVerificationToken; clicking it invokes
     * GET /api/auth/verify-email?token=<uuid>, which activates the account
     * and clears the token.
     *
     * Uses the "email-verification" Thymeleaf template.  See
     * src/main/resources/templates/email-verification.html.
     */
    @Async
    public void sendVerificationEmail(String to, String name, String verificationLink) {
        Context ctx = new Context();
        ctx.setVariable("name",             name);
        ctx.setVariable("verificationLink", verificationLink);
        sendHtml(to, "Verify your email address", "email-verification", ctx);
    }

    // ── internal ──────────────────────────────────────────────────────────────

    private void sendHtml(String to, String subject, String template, Context ctx) {
        log.info("Preparing email: template='{}', recipient='{}', brevoApiKeyConfigured={}, mailFromConfigured={}",
                template, maskEmail(to), StringUtils.hasText(brevoApiKey), StringUtils.hasText(mailFrom));
        try {
            if (!StringUtils.hasText(brevoApiKey)) {
                log.error("BREVO_API_KEY is not configured");
                return;
            }
            if (!StringUtils.hasText(mailFrom)) {
                log.error("MAIL_FROM is not configured");
                return;
            }

            String html = templateEngine.process(template, ctx);
            log.info("Rendered email: template='{}', recipient='{}', htmlLength={}",
                    template, maskEmail(to), html.length());

            Map<String, Object> request = Map.of(
                    "sender", Map.of(
                            "name", StringUtils.hasText(mailFromName) ? mailFromName : "ApexHK",
                            "email", mailFrom
                    ),
                    "to", List.of(Map.of("email", to)),
                    "subject", subject,
                    "htmlContent", html
            );

            log.info("Sending email via Brevo API: template='{}', recipient='{}', senderConfigured={}",
                    template, maskEmail(to), StringUtils.hasText(mailFrom));
            ResponseEntity<Map> response = restClient.post()
                    .uri(BREVO_EMAIL_ENDPOINT)
                    .header("api-key", brevoApiKey)
                    .body(request)
                    .retrieve()
                    .toEntity(Map.class);

            Object messageId = response.getBody() != null ? response.getBody().get("messageId") : null;
            log.info("Brevo email accepted: template='{}', recipient='{}', httpStatus={}, messageIdPresent={}",
                    template, maskEmail(to), response.getStatusCode().value(), messageId != null);
        } catch (RestClientResponseException e) {
            log.error("Brevo email failed: template='{}', status={}, category={}",
                    template, e.getStatusCode().value(), brevoErrorCategory(e));
        } catch (Exception e) {
            log.error("Email send failed: template='{}', category={}", template,
                    e.getClass().getSimpleName(), e);
        }
    }

    private String maskEmail(String email) {
        if (!StringUtils.hasText(email)) return "";
        int at = email.indexOf('@');
        if (at <= 1) return "***";
        return email.charAt(0) + "***" + email.substring(at);
    }

    private String brevoErrorCategory(RestClientResponseException e) {
        int status = e.getStatusCode().value();
        if (status == 401 || status == 403) return "provider_auth_rejected";
        if (status >= 400 && status < 500) return "provider_request_rejected";
        if (status >= 500) return "provider_unavailable";
        return "provider_error";
    }
}
