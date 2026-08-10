package com.marketplace.model;

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
@Document(collection = "wallet_transactions")
public class WalletTransaction {

    public enum Type { CREDIT, DEBIT }

    @Id
    private String id;

    @Indexed
    private String walletId;

    @Indexed
    private String userId;

    private Type type;
    private double amount;
    private String description;
    private String referenceId;

    @CreatedDate
    private LocalDateTime createdAt;
}
