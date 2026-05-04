package sy.gov.sla.attachments.application;

import java.util.Locale;

/**
 * P2-01 + P2-02 — magic-byte sniff + MIME allow-list for uploads.
 *
 * Inspects the first ~16 bytes of an uploaded file and decides:
 *   - what its REAL content-type is (ignoring the client-supplied header)
 *   - whether that content-type is in the allow-list
 *
 * Allow-list (chosen for the Phase 6 attachments scope, D-035 / D-053):
 *   PDF, DOCX, XLSX, PNG, JPEG.
 *
 * DOCX/XLSX share the ZIP container magic bytes; we differentiate by trusting
 * the file extension WHEN the magic bytes are PK\03\04. This is a pragmatic
 * compromise — full OOXML inspection (reading [Content_Types].xml inside the
 * archive) is heavier and would require a streaming ZIP read. Acceptable
 * because the storage layer re-derives the safe extension from the sniffed
 * type (P2-04), so a renamed binary cannot pretend to be docx and end up with
 * a docx extension on disk.
 */
public final class AttachmentTypeSniffer {

    public enum SafeType {
        PDF("application/pdf", ".pdf"),
        PNG("image/png", ".png"),
        JPEG("image/jpeg", ".jpg"),
        DOCX("application/vnd.openxmlformats-officedocument.wordprocessingml.document", ".docx"),
        XLSX("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",     ".xlsx");

        public final String mimeType;
        public final String extension;

        SafeType(String mimeType, String extension) {
            this.mimeType = mimeType;
            this.extension = extension;
        }
    }

    private AttachmentTypeSniffer() {}

    /**
     * Returns the matching {@link SafeType} for the given upload, or {@code null}
     * when the magic bytes are not in the allow-list.
     *
     * @param bytes        full uploaded payload (callers already enforce the
     *                     50 MB cap before calling here, so reading the entire
     *                     array is acceptable).
     * @param filenameHint best-effort hint used only to disambiguate DOCX vs
     *                     XLSX (both are PK\03\04 ZIP containers). For non-OOXML
     *                     files the extension is ignored.
     */
    public static SafeType sniff(byte[] bytes, String filenameHint) {
        if (bytes == null || bytes.length < 4) return null;

        // PDF: %PDF-
        if (startsWith(bytes, 0x25, 0x50, 0x44, 0x46, 0x2D)) return SafeType.PDF;

        // PNG: 89 50 4E 47 0D 0A 1A 0A
        if (startsWith(bytes, 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A)) return SafeType.PNG;

        // JPEG: FF D8 FF
        if (startsWith(bytes, 0xFF, 0xD8, 0xFF)) return SafeType.JPEG;

        // ZIP container — could be DOCX or XLSX (both are OOXML/zip).
        if (startsWith(bytes, 0x50, 0x4B, 0x03, 0x04)
                || startsWith(bytes, 0x50, 0x4B, 0x05, 0x06)   // empty zip
                || startsWith(bytes, 0x50, 0x4B, 0x07, 0x08)) {
            String hint = filenameHint == null ? "" : filenameHint.toLowerCase(Locale.ROOT);
            if (hint.endsWith(".docx")) return SafeType.DOCX;
            if (hint.endsWith(".xlsx")) return SafeType.XLSX;
            // Any other ZIP-based file is rejected.
            return null;
        }
        return null;
    }

    private static boolean startsWith(byte[] data, int... signature) {
        if (data.length < signature.length) return false;
        for (int i = 0; i < signature.length; i++) {
            if ((data[i] & 0xFF) != (signature[i] & 0xFF)) return false;
        }
        return true;
    }

    /**
     * P2-04 — safe filename for the storage layer. Strips path components,
     * collapses non-alnum to '_', then forces the extension that matches
     * the sniffed MIME. Attacker-controlled extensions are discarded.
     */
    public static String safeFilename(String original, SafeType sniffed) {
        String base = original;
        if (base == null || base.isBlank()) base = "file";
        // Strip path components from any platform.
        base = base.replace('\\', '/');
        int slash = base.lastIndexOf('/');
        if (slash >= 0) base = base.substring(slash + 1);
        // Drop original extension (anything after the last dot, if any).
        int dot = base.lastIndexOf('.');
        if (dot > 0) base = base.substring(0, dot);
        // Normalise to alnum + dash/underscore.
        StringBuilder sb = new StringBuilder(base.length());
        for (char c : base.toCharArray()) {
            if (Character.isLetterOrDigit(c) || c == '_' || c == '-') sb.append(c);
            else sb.append('_');
        }
        String name = sb.toString();
        if (name.isBlank()) name = "file";
        if (name.length() > 180) name = name.substring(name.length() - 180);
        return name + sniffed.extension;
    }
}
