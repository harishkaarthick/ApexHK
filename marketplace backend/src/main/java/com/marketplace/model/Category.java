package com.marketplace.model;

import com.marketplace.enums.CategoryStatus;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "categories")
public class Category {

    @Id
    private String id;

    @Indexed(unique = true)
    private String nameKey;

    private String name;

    @Indexed(unique = true)
    private String slug;

    @Indexed
    private CategoryStatus status;

    private String requestedByVendorId;

    @CreatedDate
    private LocalDateTime createdAt;
}
