package com.marketplace.config;

import com.cloudinary.Cloudinary;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.Map;

@Configuration
public class CloudinaryConfig {

    @Value("${cloudinary.cloud-name}") private String cloudName;
    @Value("${cloudinary.api-key}")    private String apiKey;
    @Value("${cloudinary.api-secret}") private String apiSecret;

    @Bean
    public Cloudinary cloudinary() {
        return new Cloudinary(Map.of(
                "cloud_name", String.valueOf(cloudName).trim(),
                "api_key",    String.valueOf(apiKey).trim(),
                "api_secret", String.valueOf(apiSecret).trim(),
                "secure",     true));
    }
    
  
    
}