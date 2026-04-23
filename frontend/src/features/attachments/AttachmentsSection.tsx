// Phase 10 — Reusable AttachmentsSection (Phase 6 D-035 / D-036).
// Renders a list + upload button + per-row download button, scoped to either
// a CASE_STAGE or an EXECUTION_FILE. Upload visibility is decided by the
// caller (passing `canUpload`). The backend re-checks D-036 unconditionally.

import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  downloadAttachment,
  listExecutionFileAttachments,
  listStageAttachments,
  uploadExecutionFileAttachment,
  uploadStageAttachment,
} from './api';
import { Card, CardBody, CardHeader, CardTitle } from '@/shared/ui/Card';
import { Spinner } from '@/shared/ui/Spinner';
import { Button } from '@/shared/ui/Button';
import { Table, TBody, TD, TH, THead, TR } from '@/shared/ui/Table';
import { extractApiErrorMessage } from '@/shared/lib/apiError';
import type { Attachment } from '@/shared/types/domain';

const MAX_BYTES = 50 * 1024 * 1024; // backend: 50MB FILE_TOO_LARGE

interface BaseProps {
  /** Whether the upload button should be rendered (D-036 client-side hint). */
  canUpload: boolean;
}

interface StageProps extends BaseProps {
  scope: 'STAGE';
  stageId: number;
}
interface ExecProps extends BaseProps {
  scope: 'EXECUTION_FILE';
  fileId: number;
}

type Props = StageProps | ExecProps;

export function AttachmentsSection(props: Props) {
  const qc = useQueryClient();
  const queryKey: readonly unknown[] =
    props.scope === 'STAGE'
      ? ['attachments', 'stage', props.stageId]
      : ['attachments', 'execution-file', props.fileId];

  const listQ = useQuery({
    queryKey,
    queryFn: () =>
      props.scope === 'STAGE'
        ? listStageAttachments(props.stageId)
        : listExecutionFileAttachments(props.fileId),
  });

  const [actionError, setActionError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadMut = useMutation({
    mutationFn: (file: File) =>
      props.scope === 'STAGE'
        ? uploadStageAttachment(props.stageId, file)
        : uploadExecutionFileAttachment(props.fileId, file),
    onSuccess: () => {
      setActionError(null);
      void qc.invalidateQueries({ queryKey });
      if (inputRef.current) inputRef.current.value = '';
    },
    onError: (e) => setActionError(extractApiErrorMessage(e)),
  });

  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const onDownload = async (a: Attachment) => {
    setActionError(null);
    setDownloadingId(a.id);
    try {
      await downloadAttachment(a);
    } catch (e) {
      setActionError(extractApiErrorMessage(e, 'تعذّر تنزيل المرفق.'));
    } finally {
      setDownloadingId(null);
    }
  };

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_BYTES) {
      setActionError('الملف يتجاوز الحد الأقصى المسموح (50MB).');
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    uploadMut.mutate(f);
  };

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>المرفقات</CardTitle>
      </CardHeader>
      <CardBody>
        {actionError && (
          <div role="alert" className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {actionError}
          </div>
        )}

        <div className="mb-3 flex items-center gap-2">
          {props.canUpload ? (
            <>
              <input
                ref={inputRef}
                type="file"
                className="hidden"
                onChange={onPickFile}
                aria-label="اختر ملفًا للرفع"
              />
              <Button
                variant="secondary"
                size="sm"
                disabled={uploadMut.isPending}
                onClick={() => inputRef.current?.click()}
              >
                {uploadMut.isPending ? <Spinner /> : null}
                <span>رفع مرفق</span>
              </Button>
              <span className="text-xs text-slate-400">حتى 50MB لكل ملف.</span>
            </>
          ) : (
            <p className="text-xs text-slate-400">
              لا تملك صلاحية رفع المرفقات على هذا النطاق (D-036).
            </p>
          )}
        </div>

        {listQ.isLoading && <Spinner className="text-brand-600" />}
        {listQ.isError && (
          <p className="text-sm text-red-600">تعذّر تحميل المرفقات.</p>
        )}
        {listQ.data && listQ.data.length === 0 && (
          <p className="text-sm text-slate-500">لا توجد مرفقات.</p>
        )}
        {listQ.data && listQ.data.length > 0 && (
          <Table>
            <THead>
              <TR>
                <TH>اسم الملف</TH>
                <TH>النوع</TH>
                <TH>الحجم</TH>
                <TH>رُفع بتاريخ</TH>
                <TH>بواسطة</TH>
                <TH className="text-end">إجراء</TH>
              </TR>
            </THead>
            <TBody>
              {listQ.data.map((a) => (
                <TR key={a.id}>
                  <TD className="break-all">{a.originalFilename}</TD>
                  <TD className="text-xs text-slate-500">{a.contentType}</TD>
                  <TD className="text-xs text-slate-500">{formatBytes(a.fileSizeBytes)}</TD>
                  <TD className="text-xs text-slate-500">{a.uploadedAt}</TD>
                  <TD className="text-xs text-slate-500">#{a.uploadedByUserId}</TD>
                  <TD className="text-end">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={downloadingId === a.id}
                      onClick={() => onDownload(a)}
                    >
                      {downloadingId === a.id ? <Spinner /> : null}
                      <span>تنزيل</span>
                    </Button>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </CardBody>
    </Card>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

