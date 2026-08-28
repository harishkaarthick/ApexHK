package com.marketplace.service;

import com.marketplace.model.Product;
import com.marketplace.model.Vendor;
import com.marketplace.repository.ProductRepository;
import com.marketplace.repository.VendorRepository;
import com.marketplace.util.CloudinaryUploader;
import com.mongodb.client.result.UpdateResult;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProductServiceDeleteTest {

    @Mock private ProductRepository productRepository;
    @Mock private VendorRepository vendorRepository;
    @Mock private CloudinaryUploader cloudinaryUploader;
    @Mock private CategoryService categoryService;
    @Mock private MongoTemplate mongoTemplate;
    @Mock private ProductSearchService productSearchService;

    @InjectMocks private ProductService productService;

    @Test
    void activeProductDeleteDecrementsVendorCountOnce() {
        when(productRepository.findById("product-1"))
                .thenReturn(Optional.of(Product.builder().id("product-1").vendorId("vendor-1").isActive(true).build()));
        when(mongoTemplate.updateFirst(any(Query.class), any(Update.class), eq(Product.class)))
                .thenReturn(UpdateResult.acknowledged(1, 1L, null));

        productService.delete("product-1", "vendor-1");

        verify(mongoTemplate).updateFirst(any(Query.class), any(Update.class), eq(Vendor.class));
    }

    @Test
    void repeatedProductDeleteDoesNotDecrementVendorCountAgain() {
        when(productRepository.findById("product-1"))
                .thenReturn(Optional.of(Product.builder().id("product-1").vendorId("vendor-1").isActive(false).build()));
        when(mongoTemplate.updateFirst(any(Query.class), any(Update.class), eq(Product.class)))
                .thenReturn(UpdateResult.acknowledged(0, 0L, null));

        productService.delete("product-1", "vendor-1");

        verify(mongoTemplate, never()).updateFirst(any(Query.class), any(Update.class), eq(Vendor.class));
    }
}
