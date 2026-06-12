// Phase 2 (#3) — تحت الرفع register.
//
// A searchable table of pending submissions (letters not yet filed as cases).
// Add/Edit is gated to users with an active SECTION_HEAD / ADMIN_CLERK
// membership (canManagePendingSubmissions); branch-heads / admins / lawyers
// see the table read-only. The add/edit form limits branch+department to the
// user's own memberships (same pattern as CreateCasePage). Backend
// re-validates scope on every write.

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import {
  createPendingSubmission,
  listPendingSubmissions,
  updatePendingSubmission,
  type CreatePendingSubmissionRequest,
  type PendingSubmission,
} from './api';
import { useAuth } from '@/features/auth/AuthContext';
import { canManagePendingSubmissions } from '@/features/auth/permissions';
import { listBranches, listDepartments } from '@/shared/api/lookups';
import { Card, CardBody, CardHeader, CardTitle } from '@/shared/ui/Card';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Spinner } from '@/shared/ui/Spinner';
import { Table, TBody, TD, TH, THead, TR } from '@/shared/ui/Table';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { Select, Textarea } from '@/shared/ui/FormFields';
import { Modal } from '@/shared/ui/Modal';
import { extractApiErrorMessage } from '@/shared/lib/apiError';
import { DEPARTMENT_TYPE_LABEL_AR } from '@/shared/types/domain';

const PAGE_SIZE = 20;
const DASH = '—';

export function PendingSubmissionsPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const canManage = canManagePendingSubmissions(user);

  const [page, setPage] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [appliedQ, setAppliedQ] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PendingSubmission | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => { setPage(0); }, [appliedQ]);

  const listQ = useQuery({
    queryKey: ['pending-submissions', { page, size: PAGE_SIZE, q: appliedQ }],
    queryFn: () => listPendingSubmissions({ page, size: PAGE_SIZE, q: appliedQ || undefined }),
    placeholderData: (prev) => prev,
  });

  const saveMut = useMutation({
    mutationFn: (input: { id: number | null; body: CreatePendingSubmissionRequest }) =>
      input.id == null
        ? createPendingSubmission(input.body)
        : updatePendingSubmission(input.id, input.body),
    onSuccess: () => {
      setActionError(null);
      setModalOpen(false);
      setEditing(null);
      void qc.invalidateQueries({ queryKey: ['pending-submissions'] });
    },
    onError: (e) => setActionError(extractApiErrorMessage(e, 'تعذّر حفظ القيد.')),
  });

  const openCreate = () => { setEditing(null); setActionError(null); setModalOpen(true); };
  const openEdit = (row: PendingSubmission) => { setEditing(row); setActionError(null); setModalOpen(true); };

  return (
    <>
      <PageHeader
        title="تحت الرفع"
        subtitle="الكتب الواردة التي لم تُقيَّد بعد كدعاوى."
        actions={
          canManage ? <Button onClick={openCreate}>+ إضافة قيد</Button> : undefined
        }
      />

      <Card className="mb-4">
        <CardHeader><CardTitle>بحث</CardTitle></CardHeader>
        <CardBody>
          <form
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
            onSubmit={(e) => { e.preventDefault(); setAppliedQ(searchInput.trim()); }}
          >
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-slate-600">
                بحث (رقم الوارد / رقم الكتاب / الجهة / الخصم)
              </label>
              <Input
                type="text"
                placeholder="مثال: 1234 أو وزارة العدل"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => { setSearchInput(''); setAppliedQ(''); }}
              >
                مسح
              </Button>
              <Button type="submit">تطبيق</Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>القائمة</CardTitle></CardHeader>
        <CardBody>
          {listQ.isLoading && <Spinner className="text-brand-600" />}
          {listQ.isError && (
            <p className="text-sm text-red-600">
              {extractApiErrorMessage(listQ.error, 'تعذّر تحميل القائمة.')}
            </p>
          )}

          {listQ.data && listQ.data.content.length === 0 && (
            <p className="text-sm text-slate-500">لا توجد قيود مطابقة.</p>
          )}

          {listQ.data && listQ.data.content.length > 0 && (
            <>
              <Table>
                <THead>
                  <TR>
                    <TH>رقم الوارد</TH>
                    <TH>رقم الكتاب</TH>
                    <TH>الجهة العامة</TH>
                    <TH>الخصم</TH>
                    <TH>موضوع الكتاب</TH>
                    <TH>ملاحظات</TH>
                    {canManage && <TH className="text-end">إجراء</TH>}
                  </TR>
                </THead>
                <TBody>
                  {listQ.data.content.map((row) => (
                    <TR key={row.id}>
                      <TD>{row.incomingNumber || DASH}</TD>
                      <TD>{row.letterNumber || DASH}</TD>
                      <TD>{row.publicEntityName || DASH}</TD>
                      <TD>{row.opponentName || DASH}</TD>
                      <TD className="whitespace-pre-wrap">{row.subject || DASH}</TD>
                      <TD className="whitespace-pre-wrap">{row.notes || DASH}</TD>
                      {canManage && (
                        <TD className="text-end">
                          <Button size="sm" variant="secondary" onClick={() => openEdit(row)}>
                            تعديل
                          </Button>
                        </TD>
                      )}
                    </TR>
                  ))}
                </TBody>
              </Table>

              <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
                <div>
                  الصفحة {listQ.data.page + 1} من {Math.max(listQ.data.totalPages, 1)} — الإجمالي{' '}
                  {listQ.data.totalElements}
                  {listQ.isFetching && (
                    <Spinner className="ms-2 inline-block h-3 w-3 text-brand-600" />
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="secondary" size="sm"
                    disabled={page <= 0 || listQ.isFetching}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                  >
                    السابق
                  </Button>
                  <Button
                    variant="secondary" size="sm"
                    disabled={page + 1 >= listQ.data.totalPages || listQ.isFetching}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    التالي
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardBody>
      </Card>

      {canManage && modalOpen && (
        <PendingSubmissionModal
          editing={editing}
          submitting={saveMut.isPending}
          error={actionError}
          onClose={() => { setModalOpen(false); setEditing(null); setActionError(null); }}
          onSubmit={(body) => saveMut.mutate({ id: editing?.id ?? null, body })}
        />
      )}
    </>
  );
}

// ──────────────────────────────────────────────────────────────
// Add / Edit modal — branch + department limited to the user's own
// SECTION_HEAD / ADMIN_CLERK memberships (same pattern as CreateCasePage).
// ──────────────────────────────────────────────────────────────

const schema = z.object({
  branchId:         z.coerce.number().int().positive('اختر الفرع'),
  departmentId:     z.coerce.number().int().positive('اختر القسم'),
  incomingNumber:   z.string().trim().min(1, 'مطلوب').max(64),
  letterNumber:     z.string().trim().min(1, 'مطلوب').max(64),
  publicEntityName: z.string().trim().min(1, 'مطلوب').max(200),
  opponentName:     z.string().trim().min(1, 'مطلوب').max(200),
  subject:          z.string().trim().min(1, 'مطلوب').max(500),
  notes:            z.string().trim().max(1000).optional().or(z.literal('')),
});
type FormValues = z.infer<typeof schema>;

function PendingSubmissionModal({
  editing, submitting, error, onClose, onSubmit,
}: {
  editing: PendingSubmission | null;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (body: CreatePendingSubmissionRequest) => void;
}) {
  const { user } = useAuth();

  const {
    register, handleSubmit, watch, setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: editing
      ? {
          branchId: editing.branchId,
          departmentId: editing.departmentId,
          incomingNumber: editing.incomingNumber,
          letterNumber: editing.letterNumber,
          publicEntityName: editing.publicEntityName,
          opponentName: editing.opponentName,
          subject: editing.subject,
          notes: editing.notes ?? '',
        }
      : { notes: '' },
  });

  const branchesQ = useQuery({ queryKey: ['lookup', 'branches'], queryFn: listBranches });

  const allowedBranchIds = useMemo(() => {
    if (!user) return new Set<number>();
    return new Set(
      user.departmentMemberships
        .filter((m) => m.active && (m.membershipType === 'SECTION_HEAD' || m.membershipType === 'ADMIN_CLERK'))
        .map((m) => m.branchId),
    );
  }, [user]);

  const visibleBranches = useMemo(
    () => (branchesQ.data ?? []).filter((b) => b.active && allowedBranchIds.has(b.id)),
    [branchesQ.data, allowedBranchIds],
  );

  const branchId = watch('branchId');

  const departmentsQ = useQuery({
    queryKey: ['lookup', 'departments', branchId],
    queryFn: () => listDepartments(Number(branchId)),
    enabled: !!branchId,
  });

  const allowedDeptIds = useMemo(() => {
    if (!user || !branchId) return new Set<number>();
    return new Set(
      user.departmentMemberships
        .filter(
          (m) =>
            m.active &&
            m.branchId === Number(branchId) &&
            (m.membershipType === 'SECTION_HEAD' || m.membershipType === 'ADMIN_CLERK') &&
            m.departmentId != null,
        )
        .map((m) => m.departmentId as number),
    );
  }, [user, branchId]);

  const visibleDepartments = useMemo(
    () => (departmentsQ.data ?? []).filter((d) => d.active && allowedDeptIds.has(d.id)),
    [departmentsQ.data, allowedDeptIds],
  );

  // Reset department when branch changes (skip on the initial edit prefill).
  const isEdit = editing != null;
  useEffect(() => {
    if (isEdit) return;
    setValue('departmentId', 0 as unknown as number);
  }, [branchId, isEdit, setValue]);

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? 'تعديل قيد' : 'إضافة قيد'}
      footer={
        <>
          <Button type="submit" form="pending-submission-form" disabled={submitting}>
            {submitting ? <Spinner /> : null}<span>حفظ</span>
          </Button>
          <Button variant="ghost" onClick={onClose}>إلغاء</Button>
        </>
      }
    >
      {error && (
        <div role="alert" className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <form
        id="pending-submission-form"
        className="space-y-3"
        noValidate
        onSubmit={handleSubmit((v) => onSubmit({
          branchId: Number(v.branchId),
          departmentId: Number(v.departmentId),
          incomingNumber: v.incomingNumber,
          letterNumber: v.letterNumber,
          publicEntityName: v.publicEntityName,
          opponentName: v.opponentName,
          subject: v.subject,
          notes: v.notes ?? '',
        }))}
      >
        <ModalField label="الفرع" error={errors.branchId?.message}>
          <Select {...register('branchId')} disabled={branchesQ.isLoading}>
            <option value="">— اختر —</option>
            {visibleBranches.map((b) => (
              <option key={b.id} value={b.id}>{b.nameAr}</option>
            ))}
          </Select>
        </ModalField>

        <ModalField label="القسم" error={errors.departmentId?.message}>
          <Select {...register('departmentId')} disabled={!branchId || departmentsQ.isLoading}>
            <option value="">— اختر —</option>
            {visibleDepartments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nameAr || DEPARTMENT_TYPE_LABEL_AR[d.type]}
              </option>
            ))}
          </Select>
        </ModalField>

        <ModalField label="رقم الوارد" error={errors.incomingNumber?.message}>
          <Input {...register('incomingNumber')} />
        </ModalField>

        <ModalField label="رقم الكتاب" error={errors.letterNumber?.message}>
          <Input {...register('letterNumber')} />
        </ModalField>

        <ModalField label="الجهة العامة" error={errors.publicEntityName?.message}>
          <Input {...register('publicEntityName')} />
        </ModalField>

        <ModalField label="الخصم" error={errors.opponentName?.message}>
          <Input {...register('opponentName')} />
        </ModalField>

        <ModalField label="موضوع الكتاب" error={errors.subject?.message}>
          <Textarea rows={2} {...register('subject')} />
        </ModalField>

        <ModalField label="ملاحظات (اختياري)" error={errors.notes?.message}>
          <Textarea rows={2} {...register('notes')} />
        </ModalField>
      </form>
    </Modal>
  );
}

function ModalField({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
