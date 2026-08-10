package com.marketplace.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Getter;
import org.springframework.http.*;

@Getter
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ApiResponse<T> {

    private final boolean success;
    private final String  message;
    private final T       data;
    private final int     status;

    private ApiResponse(boolean success, String message, T data, int status) {
        this.success = success;
        this.message = message;
        this.data    = data;
        this.status  = status;
    }

    public static <T> ResponseEntity<ApiResponse<T>> ok(String message, T data) {
        return ResponseEntity.ok(new ApiResponse<>(true, message, data, 200));
    }

    public static <T> ResponseEntity<ApiResponse<T>> ok(T data) {
        return ok("Success", data);
    }

    public static <T> ResponseEntity<ApiResponse<T>> created(String message, T data) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(new ApiResponse<>(true, message, data, 201));
    }

    public static <T> ResponseEntity<ApiResponse<T>> noContent(String message) {
        return ResponseEntity.ok(new ApiResponse<>(true, message, null, 200));
    }
}