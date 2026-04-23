package sy.gov.sla.attachments.application;

import java.io.IOException;
import java.io.InputStream;

/**
 * Storage abstraction للمرفقات (D-035).
 *
 * يُغلِّف عملية الحفظ/الاسترجاع بحيث يمكن استبدال الـ adapter لاحقًا
 * (S3/MinIO/Azure Blob ... إلخ) دون تغيير الـ application أو الـ domain.
 *
 * المسؤوليات:
 *  - {@link #store(InputStream, String)}  يُخزّن المحتوى ويُرجع `storageKey` فريدًا.
 *  - {@link #open(String)}                يفتح stream للقراءة.
 */
public interface AttachmentStoragePort {

    /**
     * يحفظ stream الإدخال تحت اسم منطقي مقترح، ويعيد storage key فريدًا
     * (يُخزَّن في عمود attachments.storage_key). الـ adapter حر في إعادة كتابة
     * الاسم لإضافة بادئات/تواريخ/UUID لتجنب الاصطدام.
     */
    String store(InputStream content, String filenameHint) throws IOException;

    /**
     * يفتح المحتوى للقراءة. على المستدعي إغلاق الـ stream.
     */
    InputStream open(String storageKey) throws IOException;

    /**
     * طول الملف بالبايت (للتحقق/HTTP headers).
     */
    long size(String storageKey) throws IOException;
}

