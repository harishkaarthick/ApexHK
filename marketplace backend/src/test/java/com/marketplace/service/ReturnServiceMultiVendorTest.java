package com.marketplace.service;

import com.marketplace.dto.request.ReturnRequestDto;
import com.marketplace.enums.OrderStatus;
import com.marketplace.enums.ReturnReason;
import com.marketplace.enums.ReturnStatus;
import com.marketplace.exception.UnauthorizedException;
import com.marketplace.model.Order;
import com.marketplace.model.OrderItem;
import com.marketplace.model.ReturnRequest;
import com.marketplace.model.VendorOrder;
import com.marketplace.repository.OrderRepository;
import com.marketplace.repository.ReturnRepository;
import com.marketplace.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ReturnServiceMultiVendorTest {

    @Mock private ReturnRepository returnRepository;
    @Mock private OrderRepository orderRepository;
    @Mock private UserRepository userRepository;
    @Mock private WalletService walletService;
    @Mock private NotificationService notificationService;
    @Mock private EmailService emailService;
    @Mock private com.razorpay.RazorpayClient razorpayClient;
    @Mock private org.springframework.data.mongodb.core.MongoTemplate mongoTemplate;
    @Mock private com.marketplace.util.CloudinaryUploader cloudinaryUploader;

    @InjectMocks private ReturnService returnService;

    @Test
    void createStoresVendorIdAndOrderItemIdFromDeliveredVendorOrder() {
        Order order = multiVendorOrder(OrderStatus.DELIVERED, OrderStatus.CONFIRMED);
        ReturnRequestDto.Create request = createRequest("item-a");

        when(orderRepository.findById("order-1")).thenReturn(Optional.of(order));
        when(returnRepository.findByOrderItemIdAndCustomerId("item-a", "customer-1"))
                .thenReturn(List.of());
        when(returnRepository.save(any(ReturnRequest.class))).thenAnswer(invocation -> {
            ReturnRequest saved = invocation.getArgument(0);
            saved.setId("return-a");
            return saved;
        });

        returnService.create("customer-1", request);

        ArgumentCaptor<ReturnRequest> savedReturn = ArgumentCaptor.forClass(ReturnRequest.class);
        verify(returnRepository).save(savedReturn.capture());
        assertThat(savedReturn.getValue().getVendorId()).isEqualTo("vendor-a");
        assertThat(savedReturn.getValue().getOrderItemId()).isEqualTo("item-a");

        assertThat(order.getItems().get(0).isReturnRequest()).isTrue();
        assertThat(order.getItems().get(1).isReturnRequest()).isFalse();
        verify(orderRepository).save(order);
    }

    @Test
    void createRejectsItemWhoseVendorOrderIsNotDelivered() {
        Order order = multiVendorOrder(OrderStatus.DELIVERED, OrderStatus.CONFIRMED);

        when(orderRepository.findById("order-1")).thenReturn(Optional.of(order));

        assertThatThrownBy(() -> returnService.create("customer-1", createRequest("item-b")))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Only delivered orders can be returned");

        verify(returnRepository, never()).save(any());
        assertThat(order.getItems()).noneMatch(OrderItem::isReturnRequest);
    }

    @Test
    void vendorRejectClearsOnlyTheExactReturnedOrderItem() {
        ReturnRequest existing = ReturnRequest.builder()
                .id("return-1")
                .orderId("order-1")
                .orderItemId("item-b")
                .vendorId("vendor-a")
                .customerId("customer-1")
                .productId("same-product")
                .status(ReturnStatus.UNDER_REVIEW)
                .build();
        OrderItem first = OrderItem.builder()
                .id("item-a")
                .productId("same-product")
                .returnRequest(true)
                .build();
        OrderItem second = OrderItem.builder()
                .id("item-b")
                .productId("same-product")
                .returnRequest(true)
                .build();
        Order order = Order.builder().id("order-1").items(List.of(first, second)).build();
        ReturnRequestDto.Reject reject = new ReturnRequestDto.Reject();
        reject.setReason("Damaged by customer");

        when(returnRepository.findById("return-1")).thenReturn(Optional.of(existing));
        when(orderRepository.findById("order-1")).thenReturn(Optional.of(order));

        returnService.vendorReject("return-1", "vendor-a", reject);

        assertThat(first.isReturnRequest()).isTrue();
        assertThat(second.isReturnRequest()).isFalse();
        verify(orderRepository).save(order);
    }

    @Test
    void createAllowsRefilingAfterAPriorReturnWasRejected() {
        Order order = multiVendorOrder(OrderStatus.DELIVERED, OrderStatus.CONFIRMED);
        ReturnRequestDto.Create request = createRequest("item-a");

        ReturnRequest priorRejected = ReturnRequest.builder()
                .id("return-old")
                .orderItemId("item-a")
                .customerId("customer-1")
                .status(ReturnStatus.REJECTED)
                .build();

        when(orderRepository.findById("order-1")).thenReturn(Optional.of(order));
        when(returnRepository.findByOrderItemIdAndCustomerId("item-a", "customer-1"))
                .thenReturn(List.of(priorRejected));
        when(returnRepository.save(any(ReturnRequest.class))).thenAnswer(invocation -> {
            ReturnRequest saved = invocation.getArgument(0);
            saved.setId("return-new");
            return saved;
        });

        returnService.create("customer-1", request);

        verify(returnRepository).save(any(ReturnRequest.class));
    }

    @Test
    void createRejectsWhenAnActiveReturnAlreadyExistsForTheItem() {
        Order order = multiVendorOrder(OrderStatus.DELIVERED, OrderStatus.CONFIRMED);
        ReturnRequestDto.Create request = createRequest("item-a");

        ReturnRequest activeReturn = ReturnRequest.builder()
                .id("return-active")
                .orderItemId("item-a")
                .customerId("customer-1")
                .status(ReturnStatus.UNDER_REVIEW)
                .build();

        when(orderRepository.findById("order-1")).thenReturn(Optional.of(order));
        when(returnRepository.findByOrderItemIdAndCustomerId("item-a", "customer-1"))
                .thenReturn(List.of(activeReturn));

        assertThatThrownBy(() -> returnService.create("customer-1", request))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("already exists");

        verify(returnRepository, never()).save(any());
    }

    @Test
    void createRejectsZeroReturnQuantity() {
        Order order = multiVendorOrder(OrderStatus.DELIVERED, OrderStatus.CONFIRMED);
        ReturnRequestDto.Create request = createRequest("item-a");
        request.setQuantityToReturn(0);

        when(orderRepository.findById("order-1")).thenReturn(Optional.of(order));
        when(returnRepository.findByOrderItemIdAndCustomerId("item-a", "customer-1"))
                .thenReturn(List.of());

        assertThatThrownBy(() -> returnService.create("customer-1", request))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Return quantity must be greater than zero");

        verify(returnRepository, never()).save(any());
    }

    @Test
    void createRejectsNegativeReturnQuantity() {
        Order order = multiVendorOrder(OrderStatus.DELIVERED, OrderStatus.CONFIRMED);
        ReturnRequestDto.Create request = createRequest("item-a");
        request.setQuantityToReturn(-1);

        when(orderRepository.findById("order-1")).thenReturn(Optional.of(order));
        when(returnRepository.findByOrderItemIdAndCustomerId("item-a", "customer-1"))
                .thenReturn(List.of());

        assertThatThrownBy(() -> returnService.create("customer-1", request))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Return quantity must be greater than zero");

        verify(returnRepository, never()).save(any());
    }

    @Test
    void qualityCheckFailureRejectsReturnAndFreesOrderItemWithoutRefund() {
        ReturnRequest existing = ReturnRequest.builder()
                .id("return-1")
                .orderId("order-1")
                .orderItemId("item-a")
                .vendorId("vendor-a")
                .customerId("customer-1")
                .status(ReturnStatus.RECEIVED_AT_WAREHOUSE)
                .build();
        OrderItem item = OrderItem.builder().id("item-a").returnRequest(true).build();
        Order order = Order.builder().id("order-1").items(List.of(item)).build();

        ReturnRequestDto.QualityCheck req = new ReturnRequestDto.QualityCheck();
        req.setPassed(false);
        req.setNotes("Item was damaged by customer, not eligible");

        when(returnRepository.findById("return-1")).thenReturn(Optional.of(existing));
        when(orderRepository.findById("order-1")).thenReturn(Optional.of(order));

        var response = returnService.vendorQualityCheck("return-1", "vendor-a", req);

        assertThat(response.getStatus()).isEqualTo(ReturnStatus.REJECTED_POST_QUALITY_CHECK);
        assertThat(item.isReturnRequest()).isFalse();
        verify(walletService, never()).credit(any(), anyDouble(), any(), any());
        verify(orderRepository).save(order);
    }

    @Test
    void vendorActionsRejectOtherVendorReturnIds() {
        ReturnRequest existing = ReturnRequest.builder()
                .id("return-1")
                .vendorId("vendor-b")
                .status(ReturnStatus.RETURN_REQUESTED)
                .build();
        ReturnRequestDto.UpdateStatus request = new ReturnRequestDto.UpdateStatus();
        request.setStatus(ReturnStatus.UNDER_REVIEW);

        when(returnRepository.findById("return-1")).thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> returnService.vendorReview("return-1", "vendor-a", request))
                .isInstanceOf(UnauthorizedException.class)
                .hasMessageContaining("Not your return");

        verify(returnRepository, never()).save(any());
    }

    private ReturnRequestDto.Create createRequest(String orderItemId) {
        ReturnRequestDto.Create request = new ReturnRequestDto.Create();
        request.setOrderId("order-1");
        request.setOrderItemId(orderItemId);
        request.setReason(ReturnReason.DEFECTIVE_PRODUCT);
        return request;
    }

    private Order multiVendorOrder(OrderStatus vendorAStatus, OrderStatus vendorBStatus) {
        OrderItem itemA = OrderItem.builder()
                .id("item-a")
                .productId("product-a")
                .productName("Product A")
                .vendorId("vendor-a")
                .quantity(1)
                .totalPrice(100)
                .build();
        OrderItem itemB = OrderItem.builder()
                .id("item-b")
                .productId("product-b")
                .productName("Product B")
                .vendorId("vendor-b")
                .quantity(1)
                .totalPrice(200)
                .build();
        return Order.builder()
                .id("order-1")
                .customerId("customer-1")
                .items(List.of(itemA, itemB))
                .vendorOrders(List.of(
                        VendorOrder.builder()
                                .vendorId("vendor-a")
                                .status(vendorAStatus)
                                .deliveredAt(LocalDateTime.now().minusDays(1))
                                .items(List.of(itemA))
                                .build(),
                        VendorOrder.builder()
                                .vendorId("vendor-b")
                                .status(vendorBStatus)
                                .deliveredAt(vendorBStatus == OrderStatus.DELIVERED ? LocalDateTime.now().minusDays(1) : null)
                                .items(List.of(itemB))
                                .build()))
                .build();
    }
}
