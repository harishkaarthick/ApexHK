package com.marketplace.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.marketplace.dto.response.OrderResponse;
import com.marketplace.enums.OrderStatus;
import com.marketplace.exception.UnauthorizedException;
import com.marketplace.model.Order;
import com.marketplace.model.OrderItem;
import com.marketplace.model.User;
import com.marketplace.model.Vendor;
import com.marketplace.model.VendorOrder;
import com.marketplace.repository.CartRepository;
import com.marketplace.repository.CouponRepository;
import com.marketplace.repository.OrderRepository;
import com.marketplace.repository.ProductRepository;
import com.marketplace.repository.UserRepository;
import com.marketplace.repository.VendorRepository;
import com.marketplace.util.RazorpayUtil;
import com.razorpay.RazorpayClient;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.mongodb.core.MongoTemplate;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OrderServiceDeliveryOtpTest {

    @Mock private OrderRepository orderRepository;
    @Mock private CartRepository cartRepository;
    @Mock private ProductRepository productRepository;
    @Mock private CouponRepository couponRepository;
    @Mock private VendorRepository vendorRepository;
    @Mock private UserRepository userRepository;
    @Mock private WalletService walletService;
    @Mock private NotificationService notificationService;
    @Mock private EmailService emailService;
    @Mock private RazorpayClient razorpayClient;
    @Mock private MongoTemplate mongoTemplate;
    @Mock private RazorpayUtil razorpayUtil;

    @InjectMocks private OrderService orderService;

    @Test
    void customerCanRetrieveOwnActiveDeliveryOtp() {
        Order order = outForDeliveryOrder("482913");
        when(orderRepository.findById("order-1")).thenReturn(Optional.of(order));

        var response = orderService.getDeliveryOtp("order-1", "customer-1");

        assertThat(response.getOrderId()).isEqualTo("order-1");
        assertThat(response.getOtps()).hasSize(1);
        assertThat(response.getOtps().get(0).getOtp()).isEqualTo("482913");
        assertThat(response.getOtps().get(0).getVendorId()).isEqualTo("vendor-1");
    }

    @Test
    void customerCannotRetrieveAnotherCustomersOtp() {
        when(orderRepository.findById("order-1")).thenReturn(Optional.of(outForDeliveryOrder("482913")));

        assertThatThrownBy(() -> orderService.getDeliveryOtp("order-1", "customer-2"))
                .isInstanceOf(UnauthorizedException.class)
                .hasMessageContaining("Not your order");
    }

    @Test
    void vendorCannotRetrieveOtpThroughCustomerRetrievalMethod() {
        when(orderRepository.findById("order-1")).thenReturn(Optional.of(outForDeliveryOrder("482913")));

        assertThatThrownBy(() -> orderService.getDeliveryOtp("order-1", "vendor-user-1"))
                .isInstanceOf(UnauthorizedException.class)
                .hasMessageContaining("Not your order");
    }

    @Test
    void otpIsNotExposedAfterDeliveryCompleted() {
        Order order = outForDeliveryOrder("482913");
        order.getVendorOrders().get(0).setStatus(OrderStatus.DELIVERED);
        order.getVendorOrders().get(0).setOtpVerified(true);
        when(orderRepository.findById("order-1")).thenReturn(Optional.of(order));

        var response = orderService.getDeliveryOtp("order-1", "customer-1");

        assertThat(response.getOtps()).isEmpty();
    }

    @Test
    void existingVendorOtpVerificationStillDeliversOrder() {
        Order order = outForDeliveryOrder("482913");
        when(orderRepository.findById("order-1")).thenReturn(Optional.of(order));
        when(vendorRepository.findByUserId("vendor-user-1"))
                .thenReturn(Optional.of(Vendor.builder().id("vendor-1").build()));
        when(orderRepository.save(any(Order.class))).thenAnswer(invocation -> invocation.getArgument(0));

        OrderResponse response = orderService.verifyOtp("order-1", "vendor-user-1", "482913", "vendor-1");

        assertThat(response.getStatus()).isEqualTo(OrderStatus.DELIVERED);
        assertThat(order.getVendorOrders().get(0).getDeliveryOtp()).isNull();
        assertThat(order.getVendorOrders().get(0).getOtpVerified()).isTrue();
        verify(orderRepository).save(order);
    }

    @Test
    void emailFailureDoesNotPreventDeliveryOtpGeneration() {
        Order order = outForDeliveryOrder(null);
        order.getVendorOrders().get(0).setOtpGeneratedAt(null);
        when(orderRepository.findById("order-1")).thenReturn(Optional.of(order));
        when(userRepository.findById("customer-1"))
                .thenReturn(Optional.of(User.builder().id("customer-1").email("customer@example.com").name("Customer").build()));
        when(orderRepository.save(any(Order.class))).thenAnswer(invocation -> invocation.getArgument(0));
        doThrow(new RuntimeException("email service unavailable"))
                .when(emailService).sendDeliveryOtp(any(), any(), any(), any());

        assertThatCode(() -> orderService.generateOtp("order-1", "vendor-1"))
                .doesNotThrowAnyException();

        assertThat(order.getVendorOrders().get(0).getDeliveryOtp()).hasSize(6);
        assertThat(order.getVendorOrders().get(0).getOtpGeneratedAt()).isNotNull();
        verify(orderRepository).save(order);
    }

    @Test
    void orderResponseSerializationDoesNotExposeStoredOtp() throws Exception {
        Order order = outForDeliveryOrder("482913");

        String json = new ObjectMapper()
                .registerModule(new JavaTimeModule())
                .writeValueAsString(orderService.toResponse(order));

        assertThat(json).doesNotContain("482913");
        assertThat(json).doesNotContain("\"deliveryOtp\":");
        assertThat(json).contains("\"deliveryOtpGenerated\":true");
    }

    private Order outForDeliveryOrder(String otp) {
        OrderItem item = OrderItem.builder()
                .id("item-1")
                .productId("product-1")
                .productName("Product")
                .vendorId("vendor-1")
                .vendorName("Vendor")
                .quantity(1)
                .totalPrice(100)
                .build();
        return Order.builder()
                .id("order-1")
                .customerId("customer-1")
                .customerName("Customer")
                .items(List.of(item))
                .vendorOrders(List.of(VendorOrder.builder()
                        .vendorId("vendor-1")
                        .vendorName("Vendor")
                        .items(List.of(item))
                        .status(OrderStatus.OUT_FOR_DELIVERY)
                        .deliveryOtp(otp)
                        .otpVerified(false)
                        .otpGeneratedAt(otp == null ? null : LocalDateTime.now())
                        .subtotal(100)
                        .build()))
                .status(OrderStatus.OUT_FOR_DELIVERY)
                .totalAmount(100)
                .build();
    }
}
