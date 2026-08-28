package com.marketplace.util;

import com.cloudinary.Cloudinary;
import com.cloudinary.Uploader;
import com.marketplace.exception.BadRequestException;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class CloudinaryUploaderTest {

    @Test
    void rejectsInvalidImageBeforeCloudinaryUpload() throws Exception {
        Cloudinary cloudinary = mock(Cloudinary.class);
        Uploader uploader = mock(Uploader.class);
        when(cloudinary.uploader()).thenReturn(uploader);
        CloudinaryUploader cloudinaryUploader = new CloudinaryUploader(cloudinary, "demo", 1024);
        MockMultipartFile file = new MockMultipartFile(
                "image", "bad.jpg", "image/jpeg", "not-an-image".getBytes());

        assertThatThrownBy(() -> cloudinaryUploader.upload(file, "products"))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Invalid image file");

        verify(uploader, never()).upload(any(byte[].class), anyMap());
    }

    @Test
    void validUploadStillWorks() throws Exception {
        Cloudinary cloudinary = mock(Cloudinary.class);
        Uploader uploader = mock(Uploader.class);
        when(cloudinary.uploader()).thenReturn(uploader);
        when(uploader.upload(any(byte[].class), anyMap()))
                .thenReturn(Map.of("secure_url", "https://res.cloudinary.com/demo/image/upload/file.jpg"));
        CloudinaryUploader cloudinaryUploader = new CloudinaryUploader(cloudinary, "demo", 1024);
        MockMultipartFile file = new MockMultipartFile(
                "image", "ok.png", "image/png",
                new byte[] {(byte) 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a});

        assertThat(cloudinaryUploader.upload(file, "products"))
                .isEqualTo("https://res.cloudinary.com/demo/image/upload/file.jpg");
    }

    @Test
    void providerExceptionIsNotReturnedToClient() throws Exception {
        Cloudinary cloudinary = mock(Cloudinary.class);
        Uploader uploader = mock(Uploader.class);
        when(cloudinary.uploader()).thenReturn(uploader);
        when(uploader.upload(any(byte[].class), anyMap()))
                .thenThrow(new RuntimeException("provider internal details"));
        CloudinaryUploader cloudinaryUploader = new CloudinaryUploader(cloudinary, "demo", 1024);
        MockMultipartFile file = new MockMultipartFile(
                "image", "ok.png", "image/png",
                new byte[] {(byte) 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a});

        assertThatThrownBy(() -> cloudinaryUploader.upload(file, "products"))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("Image upload failed");
    }
}
