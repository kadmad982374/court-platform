// Phase 10 — RemindersSection (Phase 6 D-037).
//
// Mounted inside CaseDetailPage. Shows ONLY the current user's reminders for
// the case (backend-filtered) and lets them create new ones / mark them
// DONE / CANCELLED. Backend rejects any cross-owner action.

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  createReminder,
  listReminders,
  updateReminderStatus,
} from './api';
import { Card, CardBody, CardHeader, CardTitle } from '@/shared/ui/Card';
import { Spinner } from '@/shared/ui/Spinner';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { Textarea } from '@/shared/ui/FormFields';
import { Modal } from '@/shared/ui/Modal';
import { Table, TBody, TD, TH, THead, TR } from '@/shared/ui/Table';
import { extractApiErrorMessage } from '@/shared/lib/apiError';
import {
  REMINDER_STATUS_LABEL_AR,
  type CreateReminderRequest,
  type Reminder,
} from '@/shared/types/domain';

interface Props {
  caseId: number;
}

export function RemindersSection({ caseId }: Props) {
  const qc = useQueryClient();
  const queryKey = ['cases', caseId, 'reminders'] as const;

  const listQ = useQuery({
    queryKey,
    queryFn: () => listReminders(caseId),
  });

  const [actionError, setActionError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const createMut = useMutation({
    mutationFn: (body: CreateReminderRequest) => createReminder(caseId, body),
    onSuccess: () => {
      setActionError(null);
      setCreateOpen(false);
      void qc.invalidateQueries({ queryKey });
    },
    onError: (e) => setActionError(extractApiErrorMessage(e)),
  });

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: number; status: 'DONE' | 'CANCELLED' }) =>
      updateReminderStatus(id, { status }),
    onSuccess: () => {
      setActionError(null);
      void qc.invalidateQueries({ queryKey });
    },
    onError: (e) => setActionError(extractApiErrorMessage(e)),
  });

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>تذكيراتي على هذه الدعوى</CardTitle>
      </CardHeader>
      <CardBody>
        {actionError && (
          <div role="alert" className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {actionError}
          </div>
        )}

        <p className="mb-3 text-xs text-slate-500">
          التذكيرات شخصية (D-037): يَرى كل مستخدم تذكيراته فقط، ولا يمكن
          مشاركتها مع آخرين. التحويل إلى DONE أو CANCELLED للمالك فقط.
        </p>

        <div className="mb-3">
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            إنشاء تذكير
          </Button>
        </div>

        {listQ.isLoading && <Spinner className="text-brand-600" />}
        {listQ.isError && (
          <p className="text-sm text-red-600">تعذّر تحميل التذكيرات.</p>
        )}
        {listQ.data && listQ.data.length === 0 && (
          <p className="text-sm text-slate-500">لا توجد تذكيرات.</p>
        )}
        {listQ.data && listQ.data.length > 0 && (
          <Table>
            <THead>
              <TR>
                <TH>الموعد</TH>
                <TH>النص</TH>
                <TH>الحالة</TH>
                <TH>أُنشئ</TH>
                <TH className="text-end">إجراء</TH>
              </TR>
            </THead>
            <TBody>
              {listQ.data.map((r) => (
                <TR key={r.id}>
                  <TD className="text-xs text-slate-600">{r.reminderAt}</TD>
                  <TD className="whitespace-pre-wrap">{r.reminderText}</TD>
                  <TD>{REMINDER_STATUS_LABEL_AR[r.status]}</TD>
                  <TD className="text-xs text-slate-500">{r.createdAt}</TD>
                  <TD className="text-end">
                    <ReminderRowActions r={r} pending={statusMut.isPending}
                      onSetStatus={(status) => statusMut.mutate({ id: r.id, status })} />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}

        <CreateReminderModal
          open={createOpen}
          onClose={() => { setCreateOpen(false); setActionError(null); }}
          submitting={createMut.isPending}
          onSubmit={(body) => createMut.mutate(body)}
        />
      </CardBody>
    </Card>
  );
}

function ReminderRowActions({
  r, pending, onSetStatus,
}: { r: Reminder; pending: boolean;
     onSetStatus: (s: 'DONE' | 'CANCELLED') => void }) {
  if (r.status !== 'PENDING') {
    return <span className="text-xs text-slate-400">—</span>;
  }
  return (
    <div className="flex flex-wrap justify-end gap-1">
      <Button size="sm" variant="secondary" disabled={pending}
        onClick={() => onSetStatus('DONE')}>تمَّ</Button>
      <Button size="sm" variant="ghost" disabled={pending}
        onClick={() => onSetStatus('CANCELLED')}>إلغاء</Button>
    </div>
  );
}

// ---------- Create modal ----------

const createSchema = z.object({
  reminderAt:   z.string().min(1, 'مطلوب'),       // local datetime, converted to ISO on submit
  reminderText: z.string().min(1, 'مطلوب').max(500),
});
type CreateForm = z.infer<typeof createSchema>;

function CreateReminderModal({
  open, onClose, onSubmit, submitting,
}: { open: boolean; onClose: () => void; submitting: boolean;
     onSubmit: (b: CreateReminderRequest) => void }) {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
  });

  return (
    <Modal
      open={open}
      onClose={() => { reset(); onClose(); }}
      title="إنشاء تذكير"
      footer={
        <>
          <Button type="submit" form="create-reminder-form" disabled={submitting}>
            {submitting ? <Spinner /> : null}<span>حفظ</span>
          </Button>
          <Button variant="ghost" onClick={() => { reset(); onClose(); }}>إلغاء</Button>
        </>
      }
    >
      <form
        id="create-reminder-form"
        className="space-y-3"
        onSubmit={handleSubmit((v) => onSubmit({
          // Convert "YYYY-MM-DDTHH:mm" (local) → ISO instant.
          reminderAt: new Date(v.reminderAt).toISOString(),
          reminderText: v.reminderText,
        }))}
      >
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">موعد التذكير</label>
          <Input type="datetime-local" {...register('reminderAt')} />
          {errors.reminderAt && <p className="mt-1 text-xs text-red-600">{errors.reminderAt.message}</p>}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">نص التذكير</label>
          <Textarea rows={3} maxLength={500} {...register('reminderText')} />
          {errors.reminderText && <p className="mt-1 text-xs text-red-600">{errors.reminderText.message}</p>}
        </div>
        <p className="text-xs text-slate-400">
          التذكير شخصي ولا يمكن مشاركته (D-037).
        </p>
      </form>
    </Modal>
  );
}

