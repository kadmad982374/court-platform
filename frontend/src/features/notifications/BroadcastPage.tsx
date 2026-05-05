// PR-14 (customer feedback A-1 / Q-G expansion) —
// Multi-role broadcast composer.
//
// Three sender roles, scope-bounded:
//   ADMIN        : ALL / BRANCH / DEPARTMENT / USERS
//   BRANCH_HEAD  : BRANCH (own) / DEPARTMENT (within own branch) / USERS
//   SECTION_HEAD : DEPARTMENT (own) / USERS (within own department)
//
// The recipient list is preview-only — the server re-resolves recipients
// at send time from the same scope, so ticking specific users is purely a
// UX convenience (USERS scope) and a way to confirm who will receive it.

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/features/auth/AuthContext';
import { canBroadcastNotification, hasRole } from '@/features/auth/permissions';
import {
  listBroadcastRecipients,
  sendBroadcast,
  type BroadcastRecipient,
  type BroadcastRequest,
  type BroadcastScope,
} from './api';
import { listBranches, listDepartments } from '@/shared/api/lookups';
import { Card, CardBody, CardHeader, CardTitle } from '@/shared/ui/Card';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { Select, Textarea } from '@/shared/ui/FormFields';
import { Spinner } from '@/shared/ui/Spinner';
import { extractApiErrorMessage } from '@/shared/lib/apiError';
import { DEPARTMENT_TYPE_LABEL_AR, type CurrentUser } from '@/shared/types/domain';

type SenderMode =
  | { kind: 'admin' }
  | { kind: 'branch_head'; branchId: number }
  | { kind: 'section_head'; branchId: number; departmentId: number }
  | { kind: 'none' };

function detectMode(user: CurrentUser | null): SenderMode {
  if (!user) return { kind: 'none' };
  if (hasRole(user, 'CENTRAL_SUPERVISOR')) return { kind: 'admin' };
  const branchHead = user.departmentMemberships.find(
    (m) => m.active && m.membershipType === 'BRANCH_HEAD',
  );
  if (branchHead) return { kind: 'branch_head', branchId: branchHead.branchId };
  const sectionHead = user.departmentMemberships.find(
    (m) => m.active && m.membershipType === 'SECTION_HEAD' && m.departmentId != null,
  );
  if (sectionHead && sectionHead.departmentId != null) {
    return {
      kind: 'section_head',
      branchId: sectionHead.branchId,
      departmentId: sectionHead.departmentId,
    };
  }
  return { kind: 'none' };
}

const schema = z.object({
  scope: z.enum(['ALL', 'BRANCH', 'DEPARTMENT', 'USERS']),
  branchId:     z.number().int().positive().optional(),
  departmentId: z.number().int().positive().optional(),
  title: z.string().trim().min(1, 'مطلوب').max(200),
  body:  z.string().trim().min(1, 'مطلوب').max(2000),
});
type Form = z.infer<typeof schema>;

export function BroadcastPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const mode = useMemo(() => detectMode(user), [user]);

  if (!canBroadcastNotification(user)) {
    return (
      <p className="text-sm text-red-600">
        لا تملك صلاحية إرسال إشعار جماعي.
      </p>
    );
  }

  return <BroadcastForm mode={mode} onSent={() => navigate('/notifications')} />;
}

function BroadcastForm({ mode, onSent }: { mode: SenderMode; onSent: () => void }) {
  const defaultScope: BroadcastScope =
    mode.kind === 'admin'        ? 'ALL'
  : mode.kind === 'branch_head'  ? 'BRANCH'
  : mode.kind === 'section_head' ? 'DEPARTMENT'
  : 'USERS';

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      scope: defaultScope,
      branchId:     mode.kind === 'branch_head'  ? mode.branchId
                  : mode.kind === 'section_head' ? mode.branchId
                  : undefined,
      departmentId: mode.kind === 'section_head' ? mode.departmentId : undefined,
      title: '',
      body: '',
    },
  });

  const scope = watch('scope');
  const branchId = watch('branchId');
  const departmentId = watch('departmentId');

  // Selected user ids (only meaningful when scope=USERS).
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // ── Lookups ─────────────────────────────────────────────────
  const branchesQ = useQuery({
    queryKey: ['lookups', 'branches'],
    queryFn: () => listBranches(),
    enabled: mode.kind === 'admin',
    staleTime: 60_000,
  });
  const departmentsQ = useQuery({
    queryKey: ['lookups', 'departments', branchId ?? null],
    queryFn: () => listDepartments(branchId!),
    enabled: branchId != null,
    staleTime: 60_000,
  });

  // ── Recipient preview ───────────────────────────────────────
  const recipientFilter = useMemo(() => {
    if (scope === 'ALL') return { branchId: undefined, departmentId: undefined };
    if (scope === 'BRANCH') return { branchId, departmentId: undefined };
    if (scope === 'DEPARTMENT') return { branchId, departmentId };
    // USERS → narrow by whatever the composer has filled in.
    return { branchId, departmentId };
  }, [scope, branchId, departmentId]);

  const recipientsQ = useQuery({
    queryKey: ['broadcast', 'recipients', recipientFilter],
    queryFn: () => listBroadcastRecipients(recipientFilter.branchId, recipientFilter.departmentId),
    staleTime: 30_000,
  });

  // Reset selection when the scope or filter changes.
  useEffect(() => { setSelectedIds([]); }, [scope, branchId, departmentId]);

  const sendMut = useMutation({
    mutationFn: (req: BroadcastRequest) => sendBroadcast(req),
    onSuccess: () => { onSent(); },
  });

  const submit = handleSubmit((v) => {
    const req: BroadcastRequest = {
      scope: v.scope,
      title: v.title.trim(),
      body:  v.body.trim(),
    };
    if (v.scope === 'BRANCH'     && v.branchId)     req.branchId = v.branchId;
    if (v.scope === 'DEPARTMENT' && v.branchId)     req.branchId = v.branchId;
    if (v.scope === 'DEPARTMENT' && v.departmentId) req.departmentId = v.departmentId;
    if (v.scope === 'USERS')                        req.userIds = selectedIds;
    sendMut.mutate(req);
  });

  const errorMsg = sendMut.isError ? extractApiErrorMessage(sendMut.error) : null;
  const recipients: BroadcastRecipient[] = recipientsQ.data ?? [];
  const visibleRecipientCount =
    scope === 'USERS' ? selectedIds.length : recipients.length;

  return (
    <>
      <PageHeader
        title="إرسال إشعار"
        subtitle="إرسال إشعار للمحامين ضمن نطاقك (PR-14 / Q-G)."
      />

      {errorMsg && (
        <div role="alert" className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMsg}
        </div>
      )}

      <form id="broadcast-form" onSubmit={submit} className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>الجمهور</CardTitle></CardHeader>
          <CardBody className="space-y-3">
            <Field label="نطاق الإرسال">
              <Select {...register('scope')}>
                {mode.kind === 'admin' && <option value="ALL">جميع المحامين</option>}
                {(mode.kind === 'admin' || mode.kind === 'branch_head') && (
                  <option value="BRANCH">جميع محامي الفرع</option>
                )}
                <option value="DEPARTMENT">جميع محامي القسم</option>
                <option value="USERS">محامون مختارون</option>
              </Select>
            </Field>

            {(scope === 'BRANCH' || scope === 'DEPARTMENT' || scope === 'USERS')
                && mode.kind === 'admin' && (
              <Field label="الفرع">
                <Select
                  value={branchId ?? ''}
                  onChange={(e) => {
                    setValue('branchId', e.target.value ? Number(e.target.value) : undefined);
                    setValue('departmentId', undefined);
                  }}
                >
                  <option value="">اختَر</option>
                  {(branchesQ.data ?? []).map((b) => (
                    <option key={b.id} value={b.id}>{b.nameAr}</option>
                  ))}
                </Select>
              </Field>
            )}

            {(scope === 'DEPARTMENT' || scope === 'USERS')
                && (mode.kind === 'admin' || mode.kind === 'branch_head')
                && branchId != null && (
              <Field label="القسم">
                <Select
                  value={departmentId ?? ''}
                  onChange={(e) => setValue('departmentId',
                    e.target.value ? Number(e.target.value) : undefined)}
                >
                  <option value="">{scope === 'DEPARTMENT' ? 'اختَر' : 'الكل ضمن الفرع'}</option>
                  {(departmentsQ.data ?? []).map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.nameAr || DEPARTMENT_TYPE_LABEL_AR[d.type]}
                    </option>
                  ))}
                </Select>
              </Field>
            )}

            <p className="text-xs text-slate-500">
              المستلمون بعد التطبيق: <strong>{visibleRecipientCount}</strong>
              {recipientsQ.isLoading && <Spinner className="mx-1 inline-block" />}
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>محتوى الرسالة</CardTitle></CardHeader>
          <CardBody className="space-y-3">
            <Field label="العنوان" error={errors.title?.message}>
              <Input maxLength={200} {...register('title')} />
            </Field>
            <Field label="النص" error={errors.body?.message}>
              <Textarea rows={6} maxLength={2000} {...register('body')} />
            </Field>
            <div className="flex justify-end">
              <Button type="submit" disabled={sendMut.isPending}>
                {sendMut.isPending ? <Spinner /> : null}
                <span>إرسال</span>
              </Button>
            </div>
          </CardBody>
        </Card>

        {scope === 'USERS' && (
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle>اختر المحامين</CardTitle></CardHeader>
            <CardBody>
              {recipientsQ.isLoading && <Spinner className="text-brand-600" />}
              {recipientsQ.isError && (
                <p className="text-sm text-red-600">
                  {extractApiErrorMessage(recipientsQ.error, 'تعذّر تحميل المستلمين.')}
                </p>
              )}
              {recipients.length === 0 && !recipientsQ.isLoading && (
                <p className="text-sm text-slate-500">لا يوجد محامون ضمن النطاق.</p>
              )}
              {recipients.length > 0 && (
                <RecipientPicker
                  recipients={recipients}
                  selectedIds={selectedIds}
                  onChange={setSelectedIds}
                />
              )}
            </CardBody>
          </Card>
        )}
      </form>
    </>
  );
}

function RecipientPicker({
  recipients, selectedIds, onChange,
}: {
  recipients: BroadcastRecipient[];
  selectedIds: number[];
  onChange: (next: number[]) => void;
}) {
  const allChecked = recipients.length > 0 && selectedIds.length === recipients.length;
  const toggle = (id: number) => {
    onChange(selectedIds.includes(id)
      ? selectedIds.filter((x) => x !== id)
      : [...selectedIds, id]);
  };
  const toggleAll = () => {
    onChange(allChecked ? [] : recipients.map((r) => r.userId));
  };
  return (
    <>
      <label className="mb-2 inline-flex items-center gap-2 text-sm">
        <input type="checkbox" checked={allChecked} onChange={toggleAll} />
        <span>تحديد الكل ({recipients.length})</span>
      </label>
      <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2 md:grid-cols-3">
        {recipients.map((r) => (
          <li key={r.userId} className="flex items-center gap-2 rounded border border-slate-200 px-2 py-1 text-sm">
            <input
              type="checkbox"
              checked={selectedIds.includes(r.userId)}
              onChange={() => toggle(r.userId)}
            />
            <span className="flex-1 truncate">{r.fullName}</span>
            <span className="text-xs text-slate-400">{r.username}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

function Field({
  label, error, children,
}: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
