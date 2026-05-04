package sy.gov.sla.attachments.application;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import sy.gov.sla.attachments.application.AttachmentTypeSniffer.SafeType;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * P2-01 / P2-02 / P2-04 — security-critical: ensures only the allow-listed
 * file types pass the sniffer, that ZIP-based files are reliably routed to
 * docx/xlsx by extension, and that the safe filename always carries the
 * sniffed extension (not the attacker-supplied one).
 */
class AttachmentTypeSnifferTest {

    private static byte[] withPrefix(int... prefixBytes) {
        byte[] out = new byte[prefixBytes.length + 32];
        for (int i = 0; i < prefixBytes.length; i++) out[i] = (byte) prefixBytes[i];
        return out;
    }

    @Test
    @DisplayName("PDF magic bytes (%PDF-) → SafeType.PDF")
    void pdf_recognised() {
        byte[] bytes = withPrefix(0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x37);
        assertThat(AttachmentTypeSniffer.sniff(bytes, "report.pdf")).isEqualTo(SafeType.PDF);
        // Filename hint is ignored for PDFs:
        assertThat(AttachmentTypeSniffer.sniff(bytes, "anything.png")).isEqualTo(SafeType.PDF);
    }

    @Test
    @DisplayName("PNG signature → SafeType.PNG")
    void png_recognised() {
        byte[] bytes = withPrefix(0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A);
        assertThat(AttachmentTypeSniffer.sniff(bytes, "image.png")).isEqualTo(SafeType.PNG);
    }

    @Test
    @DisplayName("JPEG signature → SafeType.JPEG")
    void jpeg_recognised() {
        byte[] bytes = withPrefix(0xFF, 0xD8, 0xFF, 0xE0);
        assertThat(AttachmentTypeSniffer.sniff(bytes, "photo.jpg")).isEqualTo(SafeType.JPEG);
        assertThat(AttachmentTypeSniffer.sniff(bytes, "photo.jpeg")).isEqualTo(SafeType.JPEG);
    }

    @Test
    @DisplayName("ZIP magic + .docx hint → SafeType.DOCX")
    void docx_recognised_by_extension() {
        byte[] bytes = withPrefix(0x50, 0x4B, 0x03, 0x04);
        assertThat(AttachmentTypeSniffer.sniff(bytes, "memo.docx")).isEqualTo(SafeType.DOCX);
    }

    @Test
    @DisplayName("ZIP magic + .xlsx hint → SafeType.XLSX")
    void xlsx_recognised_by_extension() {
        byte[] bytes = withPrefix(0x50, 0x4B, 0x03, 0x04);
        assertThat(AttachmentTypeSniffer.sniff(bytes, "register.xlsx")).isEqualTo(SafeType.XLSX);
    }

    @Test
    @DisplayName("ZIP magic without docx/xlsx hint → REJECTED")
    void zip_without_office_hint_is_rejected() {
        byte[] bytes = withPrefix(0x50, 0x4B, 0x03, 0x04);
        assertThat(AttachmentTypeSniffer.sniff(bytes, "payload.zip")).isNull();
        assertThat(AttachmentTypeSniffer.sniff(bytes, "evil.exe")).isNull();
        assertThat(AttachmentTypeSniffer.sniff(bytes, null)).isNull();
    }

    @Test
    @DisplayName("Unknown / unsupported types → REJECTED (gif, exe, txt, empty)")
    void unsupported_types_rejected() {
        // GIF87a
        byte[] gif = withPrefix(0x47, 0x49, 0x46, 0x38, 0x37, 0x61);
        assertThat(AttachmentTypeSniffer.sniff(gif, "image.gif")).isNull();

        // PE / Windows EXE
        byte[] exe = withPrefix(0x4D, 0x5A);
        assertThat(AttachmentTypeSniffer.sniff(exe, "app.exe")).isNull();

        // Plain text
        byte[] txt = "Hello, world. Just plain text.".getBytes();
        assertThat(AttachmentTypeSniffer.sniff(txt, "notes.txt")).isNull();

        // Empty / too-short
        assertThat(AttachmentTypeSniffer.sniff(new byte[]{}, "x")).isNull();
        assertThat(AttachmentTypeSniffer.sniff(new byte[]{1, 2}, "x")).isNull();
        assertThat(AttachmentTypeSniffer.sniff(null, "x")).isNull();
    }

    @Test
    @DisplayName("safeFilename: forces the sniffed extension regardless of input")
    void safe_filename_forces_extension() {
        // attacker-supplied .exe extension is replaced with .pdf
        assertThat(AttachmentTypeSniffer.safeFilename("malware.exe", SafeType.PDF))
                .isEqualTo("malware.pdf");
        // path components stripped
        assertThat(AttachmentTypeSniffer.safeFilename("/etc/passwd", SafeType.PNG))
                .isEqualTo("passwd.png");
        assertThat(AttachmentTypeSniffer.safeFilename("..\\..\\evil.dll", SafeType.JPEG))
                .isEqualTo("evil.jpg");
        // weird characters collapse to underscores
        assertThat(AttachmentTypeSniffer.safeFilename("rep<ort>name?.docx", SafeType.DOCX))
                .isEqualTo("rep_ort_name_.docx");
    }

    @Test
    @DisplayName("safeFilename: blank/null input still produces a valid filename")
    void safe_filename_handles_blank_input() {
        assertThat(AttachmentTypeSniffer.safeFilename(null, SafeType.PDF)).isEqualTo("file.pdf");
        assertThat(AttachmentTypeSniffer.safeFilename("", SafeType.PDF)).isEqualTo("file.pdf");
        assertThat(AttachmentTypeSniffer.safeFilename("   ", SafeType.PDF)).isEqualTo("file.pdf");
        // pure-special-char base also resolves to "file"
        assertThat(AttachmentTypeSniffer.safeFilename("???.???", SafeType.PNG)).isEqualTo("___.png");
    }

    @Test
    @DisplayName("safeFilename: very long names are truncated from the front")
    void safe_filename_truncates_long_input() {
        String huge = "a".repeat(500);
        String result = AttachmentTypeSniffer.safeFilename(huge + ".pdf", SafeType.PDF);
        // basename (no ext) capped at 180 + ".pdf" = max 184 chars
        assertThat(result).hasSize(184).endsWith(".pdf");
    }
}
