package sy.gov.sla.attachments;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import sy.gov.sla.attachments.application.AttachmentStoragePort;
import sy.gov.sla.attachments.infrastructure.LocalFilesystemAttachmentStorage;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * D-035: local filesystem storage يحفظ ويسترجع بدقة، ويرفض المسارات الخطيرة.
 */
class LocalFilesystemAttachmentStorageUnitTest {

    @Test
    void storeAndOpenRoundtrip(@TempDir Path tmp) throws IOException {
        AttachmentStoragePort s = new LocalFilesystemAttachmentStorage(tmp.toString());
        byte[] data = "hello-world".getBytes(StandardCharsets.UTF_8);
        String key = s.store(new ByteArrayInputStream(data), "report.pdf");
        assertThat(key).contains("__report.pdf");
        try (InputStream in = s.open(key)) {
            assertThat(in.readAllBytes()).isEqualTo(data);
        }
        assertThat(s.size(key)).isEqualTo(data.length);
    }

    @Test
    void sanitizesUnsafeFilename(@TempDir Path tmp) throws IOException {
        AttachmentStoragePort s = new LocalFilesystemAttachmentStorage(tmp.toString());
        String key = s.store(new ByteArrayInputStream(new byte[]{1, 2, 3}), "../../etc/passwd");
        // المُخرجات النهائية يجب ألا تحتوي ".." في جزء اسم الملف
        assertThat(key).doesNotContain("..");
        assertThat(key).contains("__"); // فاصل uuid__name
    }

    @Test
    void openOutsideBaseDirIsRejected(@TempDir Path tmp) {
        AttachmentStoragePort s = new LocalFilesystemAttachmentStorage(tmp.toString());
        // محاولة قراءة مفتاح يحاول الخروج من baseDir
        assertThatThrownBy(() -> s.open("../outside.txt"))
                .isInstanceOf(IOException.class);
    }

    @Test
    void emptyFilenameStillStores(@TempDir Path tmp) throws IOException {
        AttachmentStoragePort s = new LocalFilesystemAttachmentStorage(tmp.toString());
        String key = s.store(new ByteArrayInputStream(new byte[]{42}), "");
        assertThat(key).endsWith("__file");
    }
}

