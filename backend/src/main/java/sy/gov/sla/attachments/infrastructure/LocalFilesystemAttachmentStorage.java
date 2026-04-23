package sy.gov.sla.attachments.infrastructure;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import sy.gov.sla.attachments.application.AttachmentStoragePort;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.*;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.UUID;

/**
 * تنفيذ local-filesystem لـ {@link AttachmentStoragePort}. مرجع: D-035.
 *
 * نمط التخزين: {baseDir}/{yyyy}/{MM}/{uuid}__{sanitized_filename}.
 *
 * مناسب للتطوير وللإصدار الأول حيث لا يتوفر object storage جاهز. يمكن استبداله
 * لاحقًا بـ S3/MinIO adapter بدون تعديل الـ application.
 */
@Component
public class LocalFilesystemAttachmentStorage implements AttachmentStoragePort {

    private final Path baseDir;
    private static final DateTimeFormatter Y = DateTimeFormatter.ofPattern("yyyy");
    private static final DateTimeFormatter M = DateTimeFormatter.ofPattern("MM");

    public LocalFilesystemAttachmentStorage(
            @Value("${sla.attachments.base-dir:./attachments-data}") String baseDirProp) {
        this.baseDir = Paths.get(baseDirProp).toAbsolutePath().normalize();
        try {
            Files.createDirectories(this.baseDir);
        } catch (IOException e) {
            throw new IllegalStateException("Cannot create attachments base dir: " + this.baseDir, e);
        }
    }

    @Override
    public String store(InputStream content, String filenameHint) throws IOException {
        LocalDate today = LocalDate.now();
        String year = today.format(Y);
        String month = today.format(M);
        String safeName = sanitize(filenameHint);
        String key = year + "/" + month + "/" + UUID.randomUUID() + "__" + safeName;
        Path target = baseDir.resolve(key).normalize();
        if (!target.startsWith(baseDir)) {
            throw new IOException("Invalid storage key path");
        }
        Files.createDirectories(target.getParent());
        try (InputStream in = content) {
            Files.copy(in, target, StandardCopyOption.REPLACE_EXISTING);
        }
        return key;
    }

    @Override
    public InputStream open(String storageKey) throws IOException {
        Path p = resolveSafe(storageKey);
        return Files.newInputStream(p);
    }

    @Override
    public long size(String storageKey) throws IOException {
        return Files.size(resolveSafe(storageKey));
    }

    private Path resolveSafe(String storageKey) throws IOException {
        Path p = baseDir.resolve(storageKey).normalize();
        if (!p.startsWith(baseDir)) {
            throw new IOException("Invalid storage key path");
        }
        return p;
    }

    private static String sanitize(String name) {
        if (name == null || name.isBlank()) return "file";
        String n = name.replace('\\', '/');
        int slash = n.lastIndexOf('/');
        if (slash >= 0) n = n.substring(slash + 1);
        // Keep alnum, dot, underscore, hyphen, Arabic letters; replace others with '_'
        StringBuilder sb = new StringBuilder(n.length());
        for (char c : n.toCharArray()) {
            if (Character.isLetterOrDigit(c) || c == '.' || c == '_' || c == '-') sb.append(c);
            else sb.append('_');
        }
        String s = sb.toString();
        if (s.length() > 200) s = s.substring(s.length() - 200);
        return s;
    }
}

