package com.marketplace.exception;

public class AccountNotReadyException extends RuntimeException {
    public AccountNotReadyException(String message) {
        super(message);
    }
}
