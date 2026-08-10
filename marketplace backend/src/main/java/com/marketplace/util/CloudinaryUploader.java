package com.marketplace.util;

import com.cloudinary.Cloudinary;
import com.cloudinary.Transformation;
import com.cloudinary.utils.ObjectUtils;
import com.marketplace.exception.BadRequestException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Component
public class CloudinaryUploader {

    private final Cloudinary cloudinary;
    private final boolean configured;

    public CloudinaryUploader(
            Cloudinary cloudinary,
            @Value("${cloudinary.cloud-name:}") String cloudName) {

        this.cloudinary = cloudinary;
        this.configured = StringUtils.hasText(cloudName);
    }

    public String upload(MultipartFile file, String folder) {

        if (!configured) {
            log.warn("Skipping image upload for '{}' — Cloudinary is not configured.", folder);
            return null;
        }

        if (file == null || file.isEmpty()) {
            return null;
        }

        try {

            log.info("Uploading image '{}' to Cloudinary folder '{}'",
                    file.getOriginalFilename(), folder);

            Map<?, ?> result = cloudinary.uploader().upload(
                    file.getBytes(),
                    ObjectUtils.asMap(
                            "folder", folder,
                            "public_id", UUID.randomUUID().toString(),
                            "resource_type", "image",
                            "overwrite", true,
                            "transformation",
                            new Transformation().quality("auto")
                    )
            );

            String url = (String) result.get("secure_url");

            log.info("Uploaded image '{}' to Cloudinary URL: {}",
                    file.getOriginalFilename(), url);

            return url;

        } catch (Exception e) {

            log.error("========== CLOUDINARY ERROR START ==========");
            log.error("Folder: {}", folder);
            log.error("File: {}", file.getOriginalFilename());
            log.error("Message: {}", e.getMessage(), e);
            log.error("========== CLOUDINARY ERROR END ==========");

            throw new BadRequestException(
                    "Image upload failed: " + e.getMessage()
            );
        }
    }

    public void delete(String publicId) {
        if (!configured || publicId == null) {
            return;
        }

        try {
            cloudinary.uploader().destroy(publicId, ObjectUtils.emptyMap());
        } catch (IOException e) {
            log.warn("Cloudinary delete failed: {}", e.getMessage());
        }
    }
}