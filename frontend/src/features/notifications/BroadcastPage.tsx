// PR-15a iteration (customer feedback round-2):
// Accumulative broadcast composer.
//
// Single form, three independent pickers — branches, sections, and individual
// lawyers. The recipient set is the UNION of whatever is checked across the
// three. The sender's role only restricts WHAT they see in the pickers; the
// composition itself is free-form.
//
//   ADMIN        : sees every branch, every section, every lawyer.
//   BRANCH_HEAD  : own branch (locked) + sections + lawyers within it.
//   SECTION_HEAD : own section (locked) + lawyers within it.
//
// The legacy "ALL / BRANCH / DEPARTMENT / USERS" scope dropdown is gone —
// admin gets a single "send to every state lawyer" quick toggle instead.
//
// Live recipient count comes from the union-aware preview endpoint, so what
// the composer shows matches exactly what the server will send.

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/features/auth/AuthContext';
import { canBroadcastNotification, hasRole } from '@/features/auth/permissions';
import {
  listBroadcastRecipients,
  listBroadcastRecipientsUnion,
  sendBroadcast,
  type BroadcastRecipient,
  type BroadcastRequest,
} from './api';
import { listBranches, listDepartments } from '@/shared/api/lookups';
import { Card, CardBody, CardHeader, CardTitle } from '@/shared/ui/Card';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { Textarea } from '@/shared/ui/FormFields';
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
  const { register, handleSubmit, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { title: '', body: '' },
  });

  // ── Selection state ─────────────────────────────────────────
  // Admin starts empty; branch_head & section_head come pre-checked on their
  // own scope (locked).
  const [allLawyers, setAllLawyers] = useState(false); // admin "send to everyone" toggle
  const [branchIdsSel, setBranchIdsSel] = useState<number[]>(
    mode.kind === 'branch_head' ? [mode.branchId] : [],
  );
  const [deptIdsSel, setDeptIdsSel] = useState<number[]>(
    mode.kind === 'section_head' ? [mode.departmentId] : [],
  );
  const [userIdsSel, setUserIdsSel] = useState<number[]>([]);

  // ── Lookups ─────────────────────────────────────────────────
  const branchesQ = useQuery({
    queryKey: ['lookups', 'branches'],
    queryFn: () => listBranches(),
    enabled: mode.kind === 'admin',
    staleTime: 60_000,
  });

  // Sections list: admin sees ALL sections (across branches the user has
  // checked, or the one branch we know for branch_head/section_head). For
  // admin we fetch per-branch lazily based on what's checked.
  const branchesForDeptLookup =
    mode.kind === 'admin'        ? branchIdsSel
  : mode.kind === 'branch_head'  ? [mode.branchId]
  : mode.kind === 'section_head' ? [mode.branchId]
  :                                 [];

  const departmentsQs = useQuery({
    queryKey: ['lookups', 'departments-for-broadcast', branchesForDeptLookup],
    enabled: branchesForDeptLookup.length > 0,
    queryFn: async () => {
      // Fetch each branch's departments in parallel and tag them.
      const lists = await Promise.all(
        branchesForDeptLookup.map((bId) =>
          listDepartments(bId).then((rows) => rows.map((d) => ({ ...d, branchId: bId }))),
        ),
      );
      return lists.flat();
    },
    staleTime: 60_000,
  });

  const branchNameById = useMemo(() => {
    const m = new Map<number, string>();
    (branchesQ.data ?? []).forEach((b) => m.set(b.id, b.nameAr));
    return m;
  }, [branchesQ.data]);

  // ── Two parallel queries ───────────────────────────────────
  //
  // 1) `pickableLawyersQ` — every lawyer the broadcaster can reach (admin
  //    sees all state lawyers, branch-head sees their branch, section-head
  //    sees their section). This list drives the bottom checkbox card and
  //    NEVER shrinks based on what's checked above, so the user can always
  //    pick more lawyers individually.
  //
  // 2) `previewQ` — the union of (selected branches) ∪ (selected sections) ∪
  //    (explicitly checked lawyers). Drives the recipient count shown next to
  //    the send button. Mirrors what the server will actually send to.
  //
  // `placeholderData: keepPreviousData` is critical: without it, a fresh
  // queryKey (e.g. user just ticked a lawyer) makes `data` momentarily
  // undefined → the bottom list flickers empty mid-tick. Keeping previous
  // data avoids that and keeps the UI stable while the new fetch runs.
  const keepPrev = (prev: BroadcastRecipient[] | undefined) => prev;

  const pickableLawyersQ = useQuery({
    queryKey: ['broadcast', 'pickable-lawyers'],
    queryFn: () => listBroadcastRecipients(undefined, undefined),
    staleTime: 60_000,
  });
  const pickableLawyers: BroadcastRecipient[] = pickableLawyersQ.data ?? [];

  const previewQ = useQuery({
    queryKey: ['broadcast', 'recipients-union', allLawyers, branchIdsSel, deptIdsSel, userIdsSel],
    queryFn: () => listBroadcastRecipientsUnion(
      allLawyers && mode.kind === 'admin' ? [] : branchIdsSel,
      allLawyers && mode.kind === 'admin' ? [] : deptIdsSel,
      allLawyers && mode.kind === 'admin' ? [] : userIdsSel,
    ),
    staleTime: 30_000,
    placeholderData: keepPrev,
  });
  const previewRecipients: BroadcastRecipient[] =
    allLawyers && mode.kind === 'admin' ? pickableLawyers : (previewQ.data ?? []);

  // ── Send ────────────────────────────────────────────────────
  const sendMut = useMutation({
    mutationFn: (req: BroadcastRequest) => sendBroadcast(req),
    onSuccess: () => { onSent(); },
  });

  const toggleId = (list: number[], id: number) =>
    list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

  const submit = handleSubmit((v) => {
    const base = { title: v.title.trim(), body: v.body.trim() };
    let req: BroadcastRequest;

    if (allLawyers && mode.kind === 'admin') {
      req = { ...base, scope: 'ALL' };
    } else {
      req = {
        ...base,
        scope: 'CUSTOM',
        branchIds:     branchIdsSel.length    ? branchIdsSel    : undefined,
        departmentIds: deptIdsSel.length      ? deptIdsSel      : undefined,
        userIds:       userIdsSel.length      ? userIdsSel      : undefined,
      };
    }
    sendMut.mutate(req);
  });

  const errorMsg = sendMut.isError ? extractApiErrorMessage(sendMut.error) : null;

  // ── Validity ───────────────────────────────────────────────
  const hasAnySelection =
    allLawyers ||
    branchIdsSel.length > 0 ||
    deptIdsSel.length > 0 ||
    userIdsSel.length > 0;

  return (
    <>
      <PageHeader
        title="إرسال إشعار"
        subtitle="اختر فرعًا أو أكثر، قسمًا أو أكثر، ومحامين بشكل فردي — يجمع الخادم النتيجة بدون تكرار."
      />

      {errorMsg && (
        <div role="alert" className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMsg}
        </div>
      )}

      <form id="broadcast-form" onSubmit={submit} className="grid gap-4 lg:grid-cols-2">
        {/* ── Card: audience pickers ─────────────────────────── */}
        <Card>
          <CardHeader><CardTitle>الجمهور</CardTitle></CardHeader>
          <CardBody className="space-y-4">

            {/* Admin-only "all lawyers" quick toggle. */}
            {mode.kind === 'admin' && (
              <label className="flex cursor-pointer items-center gap-2 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={allLawyers}
                  onChange={(e) => setAllLawyers(e.target.checked)}
                />
                <span className="font-medium">إرسال إلى جميع محامي الدولة</span>
                <span className="ms-auto text-xs text-slate-500">يتجاوز الاختيارات أدناه</span>
              </label>
            )}

            {/* Branches picker (admin only — others have it locked). */}
            {mode.kind === 'admin' && !allLawyers && (
              <Field label="الفروع المستهدفة (اختياري)">
                <CheckboxList
                  items={(branchesQ.data ?? [])
                    .filter((b) => b.active)
                    .map((b) => ({ id: b.id, label: b.nameAr }))}
                  selected={branchIdsSel}
                  onToggle={(id) => {
                    const next = toggleId(branchIdsSel, id);
                    setBranchIdsSel(next);
                    // Drop dept selections that no longer have a parent branch checked.
                    if (next.length === 0) setDeptIdsSel([]);
                  }}
                  empty="جارٍ التحميل…"
                />
                <p className="mt-1 text-xs text-slate-500">
                  أيّ فرع تختاره يُضيف كلّ محاميه إلى المتلقين.
                </p>
              </Field>
            )}

            {mode.kind === 'branch_head' && !allLawyers && (
              <Field label="الفرع">
                <p className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  مقيَّد بفرعك (#{mode.branchId}).
                </p>
              </Field>
            )}

            {/* Sections picker. */}
            {!allLawyers && mode.kind !== 'section_head' && (
              <Field label="الأقسام المستهدفة (اختياري)">
                {branchesForDeptLookup.length === 0 ? (
                  <p className="text-xs text-slate-400">
                    اختر فرعًا أوّلًا لرؤية أقسامه.
                  </p>
                ) : (
                  <CheckboxList
                    items={(departmentsQs.data ?? [])
                      .filter((d) => d.active)
                      .map((d) => {
                        const bName = branchNameById.get(d.branchId);
                        const dName = d.nameAr || DEPARTMENT_TYPE_LABEL_AR[d.type];
                        return {
                          id: d.id,
                          label: bName && mode.kind === 'admin' ? `${dName} — ${bName}` : dName,
                        };
                      })}
                    selected={deptIdsSel}
                    onToggle={(id) => setDeptIdsSel(toggleId(deptIdsSel, id))}
                    empty="لا توجد أقسام في هذا الفرع."
                  />
                )}
              </Field>
            )}

            {mode.kind === 'section_head' && !allLawyers && (
              <Field label="القسم">
                <p className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  مقيَّد بقسمك (#{mode.departmentId}).
                </p>
              </Field>
            )}
          </CardBody>
        </Card>

        {/* ── Card: message body ─────────────────────────────── */}
        <Card>
          <CardHeader><CardTitle>محتوى الرسالة</CardTitle></CardHeader>
          <CardBody className="space-y-3">
            <Field label="العنوان" error={errors.title?.message}>
              <Input maxLength={200} {...register('title')} />
            </Field>
            <Field label="النص" error={errors.body?.message}>
              <Textarea rows={6} maxLength={2000} {...register('body')} />
            </Field>

            <div className="flex flex-col gap-2 border-t border-slate-100 pt-3">
              <p className="text-sm">
                المتلقون بعد التطبيق:{' '}
                <strong className="tabular-nums">{previewRecipients.length}</strong>
                {previewQ.isFetching && <Spinner className="mx-1 inline-block" />}
              </p>
              {!hasAnySelection && (
                <p className="text-xs text-amber-700">
                  اختر على الأقل فرعًا أو قسمًا أو محاميًا — أو فعِّل «إرسال إلى الجميع».
                </p>
              )}
              <Button
                type="submit"
                disabled={
                  sendMut.isPending
                  || !hasAnySelection
                  || (!allLawyers && previewRecipients.length === 0)
                }
              >
                {sendMut.isPending ? <Spinner /> : null}
                <span>إرسال إلى {allLawyers ? 'جميع المحامين' : `${previewRecipients.length} محامياً`}</span>
              </Button>
            </div>
          </CardBody>
        </Card>

        {/* ── Card: lawyer-level fine-tune ───────────────────── */}
        {/* List = every lawyer the broadcaster can reach (NEVER narrowed by
            upper checkboxes). User can tick any combination — the union with
            the upper selections is what actually gets sent. */}
        {!allLawyers && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>محامون محدّدون (اختياري)</CardTitle>
            </CardHeader>
            <CardBody>
              {pickableLawyersQ.isLoading && <Spinner className="text-brand-600" />}
              {pickableLawyersQ.isError && (
                <p className="text-sm text-red-600">
                  {extractApiErrorMessage(pickableLawyersQ.error, 'تعذّر تحميل المستلمين.')}
                </p>
              )}
              {!pickableLawyersQ.isLoading && pickableLawyers.length === 0 && (
                <p className="text-sm text-slate-500">
                  لا يوجد محامون ضمن نطاقك.
                </p>
              )}
              {pickableLawyers.length > 0 && (
                <RecipientPicker
                  recipients={pickableLawyers}
                  selectedIds={userIdsSel}
                  onChange={setUserIdsSel}
                />
              )}
              <p className="mt-2 text-xs text-slate-500">
                علامة الصح هنا تضيف المحامي صراحةً إلى المتلقين، حتى إن لم يكن داخل
                فرع/قسم محدَّد.
              </p>
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

function CheckboxList({
  items, selected, onToggle, empty,
}: {
  items: ReadonlyArray<{ id: number; label: string }>;
  selected: ReadonlyArray<number>;
  onToggle: (id: number) => void;
  empty?: string;
}) {
  if (items.length === 0) {
    return <p className="text-xs text-slate-400">{empty ?? 'لا توجد خيارات.'}</p>;
  }
  return (
    <ul className="grid grid-cols-1 gap-1 rounded border border-slate-200 p-2 sm:grid-cols-2">
      {items.map((it) => (
        <li key={it.id}>
          <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-slate-50">
            <input
              type="checkbox"
              checked={selected.includes(it.id)}
              onChange={() => onToggle(it.id)}
            />
            <span className="flex-1 truncate">{it.label}</span>
          </label>
        </li>
      ))}
    </ul>
  );
}
