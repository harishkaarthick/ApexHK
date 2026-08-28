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
import java.io.InputStream;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Slf4j
@Component
public class CloudinaryUploader {

    private final Cloudinary cloudinary;
    private final boolean configured;
    private final long maxImageBytes;
    private static final Set<String> ALLOWED_CONTENT_TYPES = Set.of(
            "image/jpeg", "image/png", "image/webp", "image/gif");
    private static final Set<String> ALLOWED_EXTENSIONS = Set.of(
            "jpg", "jpeg", "png", "webp", "gif");

    public CloudinaryUploader(
            Cloudinary cloudinary,
            @Value("${cloudinary.cloud-name:}") String cloudName,
            @Value("${app.upload.max-image-size-bytes:5242880}") long maxImageBytes) {

        this.cloudinary = cloudinary;
        this.configured = StringUtils.hasText(cloudName);
        this.maxImageBytes = maxImageBytes;
    }

    public String upload(MultipartFile file, String folder) {

        if (!configured) {
            log.warn("Skipping image upload for '{}' — Cloudinary is not configured.", folder);
            return null;
        }

        if (file == null || file.isEmpty()) {
            return null;
        }

        validateImage(file);

        try {

            log.info("Uploading validated image to Cloudinary folder '{}', contentType={}, size={}",
                    folder, file.getContentType(), file.getSize());

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

            log.info("Uploaded validated image to Cloudinary folder '{}'", folder);

            return url;

        } catch (Exception e) {

            log.error("Cloudinary upload failed for folder '{}': category={}", folder, e.getClass().getSimpleName());
            throw new BadRequestException("Image upload failed");
        }
    }

    private void validateImage(MultipartFile file) {
        if (file.getSize() > maxImageBytes) {
            throw new BadRequestException("Image file is too large");
        }
        String contentType = file.getContentType();
        if (!StringUtils.hasText(contentType)
                || !ALLOWED_CONTENT_TYPES.contains(contentType.toLowerCase(Locale.ROOT))) {
            throw new BadRequestException("Unsupported image content type");
        }
        String filename = file.getOriginalFilename();
        String extension = "";
        if (StringUtils.hasText(filename)) {
            int dot = filename.lastIndexOf('.');
            if (dot >= 0 && dot < filename.length() - 1) {
                extension = filename.substring(dot + 1).toLowerCase(Locale.ROOT);
            }
        }
        if (!ALLOWED_EXTENSIONS.contains(extension)) {
            throw new BadRequestException("Unsupported image file extension");
        }
        if (!hasValidImageSignature(file)) {
            throw new BadRequestException("Invalid image file");
        }
    }

    private boolean hasValidImageSignature(MultipartFile file) {
        byte[] header = new byte[12];
        int read;
        try (InputStream in = file.getInputStream()) {
            read = in.read(header);
        } catch (IOException e) {
            return false;
        }
        if (read < 4) {
            return false;
        }
        boolean jpeg = (header[0] & 0xff) == 0xff && (header[1] & 0xff) == 0xd8 && (header[2] & 0xff) == 0xff;
        boolean png = read >= 8
                && (header[0] & 0xff) == 0x89 && header[1] == 0x50 && header[2] == 0x4e && header[3] == 0x47
                && header[4] == 0x0d && header[5] == 0x0a && header[6] == 0x1a && header[7] == 0x0a;
        boolean gif = header[0] == 0x47 && header[1] == 0x49 && header[2] == 0x46 && header[3] == 0x38;
        boolean webp = read >= 12
                && header[0] == 0x52 && header[1] == 0x49 && header[2] == 0x46 && header[3] == 0x46
                && header[8] == 0x57 && header[9] == 0x45 && header[10] == 0x42 && header[11] == 0x50;
        return jpeg || png || gif || webp;
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
