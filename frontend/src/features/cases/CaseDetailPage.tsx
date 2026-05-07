import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  getCase,
  listCaseStages,
  promoteToAppeal,
  promoteToConciliation,
  promoteToExecution,
} from './api';
import { EditCaseBasicDataModal } from './EditCaseBasicDataModal';
import { CorrectFinalizedCaseModal } from './CorrectFinalizedCaseModal';
import { AssignLawyerSection, lawyerLabel } from './AssignLawyerSection';
import { useAuth } from '@/features/auth/AuthContext';
import {
  canAssignLawyerForCase,
  canCorrectFinalizedCase,
  canEditCaseBasicData,
  canPromoteToAppeal,
  canPromoteToConciliation,
  canPromoteToExecution,
} from '@/features/auth/permissions';
import { Card, CardBody, CardHeader, CardTitle } from '@/shared/ui/Card';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Spinner } from '@/shared/ui/Spinner';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { Modal } from '@/shared/ui/Modal';
import { Table, TBody, TD, TH, THead, TR } from '@/shared/ui/Table';
import { extractApiErrorMessage } from '@/shared/lib/apiError';
import { RemindersSection } from '@/features/reminders/RemindersSection';
import {
  listAssignableLawyers,
} from '@/shared/api/users';
import {
  LIFECYCLE_LABEL_AR,
  PUBLIC_ENTITY_POSITION_LABEL_AR,
  STAGE_STATUS_LABEL_AR,
  STAGE_TYPE_LABEL_AR,
  type PromoteToExecutionRequest,
} from '@/shared/types/domain';

export function CaseDetailPage() {
  const params = useParams<{ caseId: string }>();
  const caseId = Number(params.caseId);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();

  const caseQ = useQuery({
    queryKey: ['cases', caseId],
    queryFn: () => getCase(caseId),
    enabled: Number.isFinite(caseId),
  });
  const stagesQ = useQuery({
    queryKey: ['cases', caseId, 'stages'],
    queryFn: () => listCaseStages(caseId),
    enabled: Number.isFinite(caseId),
  });

  const [actionError, setActionError] = useState<string | null>(null);
  const [promoteExecOpen, setPromoteExecOpen] = useState(false);
  const [editBasicOpen, setEditBasicOpen] = useState(false);
  const [correctOpen, setCorrectOpen] = useState(false);

  // Mini-Phase A (D-046) — when the user is allowed to assign a lawyer,
  // we already fetch the eligible-lawyers list inside AssignLawyerSection.
  // We re-use the SAME query key here so the owner-name resolution does not
  // double-fetch and stays in sync with the section's cache.
  const canSeeLawyerList = canAssignLawyerForCase(user, caseQ.data ?? null);
  const lawyersQ = useQuery({
    queryKey: caseQ.data
      ? ['lookup', 'assignable-lawyers',
          caseQ.data.createdBranchId, caseQ.data.createdDepartmentId]
      : ['lookup', 'assignable-lawyers', 'disabled'],
    queryFn: () => listAssignableLawyers(
      caseQ.data!.createdBranchId, caseQ.data!.createdDepartmentId,
    ),
    enabled: !!caseQ.data && canSeeLawyerList,
    staleTime: 30_000,
  });

  const promoteAppealMut = useMutation({
    mutationFn: () => promoteToAppeal(caseId),
    onSuccess: () => {
      setActionError(null);
      void qc.invalidateQueries({ queryKey: ['cases', caseId] });
      void qc.invalidateQueries({ queryKey: ['cases', caseId, 'stages'] });
    },
    onError: (e) => setActionError(extractApiErrorMessage(e)),
  });

  // Customer feedback round-2: "نقل الملف إلى الصلح".
  const promoteConcilMut = useMutation({
    mutationFn: () => promoteToConciliation(caseId),
    onSuccess: () => {
      setActionError(null);
      void qc.invalidateQueries({ queryKey: ['cases', caseId] });
      void qc.invalidateQueries({ queryKey: ['cases', caseId, 'stages'] });
    },
    onError: (e) => setActionError(extractApiErrorMessage(e)),
  });

  const promoteExecMut = useMutation({
    mutationFn: (body: PromoteToExecutionRequest) => promoteToExecution(caseId, body),
    onSuccess: (file) => {
      setActionError(null);
      setPromoteExecOpen(false);
      void qc.invalidateQueries({ queryKey: ['cases', caseId] });
      void qc.invalidateQueries({ queryKey: ['cases', caseId, 'stages'] });
      navigate(`/execution-files/${file.id}`);
    },
    // Error is displayed inside the modal via promoteExecMut.error — no page-level banner needed.
  });

  if (!Number.isFinite(caseId)) return <p className="text-sm text-red-600">معرّف غير صالح.</p>;

  // PR-11 (customer feedback C-6 / Q-D): correction rights live on the CURRENT
  // stage's (branch, dept) — they transfer on promotion. Resolve the current
  // stage from the stages list so the permissions helper can evaluate it.
  const currentStage =
    (stagesQ.data ?? []).find((s) => s.id === caseQ.data?.currentStageId) ?? null;
  const canCorrect = canCorrectFinalizedCase(user, currentStage);

  // PR-8 (customer feedback B-2): hide the "actions on case level" panel
  // entirely if the current user has none of the actions available
  // (so admin / branch_head no longer see an empty card).
  const showActionsCard =
    canEditCaseBasicData(user, caseQ.data ?? null)
    || canPromoteToAppeal(user)
    || canPromoteToConciliation(user)
    || canPromoteToExecution(user)
    || canCorrect;

  // PR-8b (customer feedback Q-G correction): the reminders section is now
  // shown to ALL roles with case-read access. Lawyers see + author their own
  // reminders; managers (SECTION_HEAD / BRANCH_HEAD / ADMIN_CLERK / admin)
  // see them as read-only oversight. Per-row Done/Cancel and the Create
  // button are gated INSIDE the section.

  return (
    <>
      <PageHeader title={`الدعوى رقم ${caseId}`} subtitle="البيانات الأساسية والمراحل." />

      {actionError && (
        <div role="alert" className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {actionError}
        </div>
      )}

      <div className={showActionsCard ? 'grid gap-4 lg:grid-cols-2' : ''}>
        <Card>
          <CardHeader>
            <CardTitle>المعلومات الأساسية</CardTitle>
          </CardHeader>
          <CardBody>
            {caseQ.isLoading && <Spinner className="text-brand-600" />}
            {caseQ.isError && (
              <p className="text-sm text-red-600">
                {extractApiErrorMessage(caseQ.error, 'تعذّر تحميل الدعوى.')}
              </p>
            )}
            {caseQ.data && (
              <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <Field k="رقم الأساس" v={caseQ.data.originalBasisNumber} />
                <Field k="السنة"    v={String(caseQ.data.basisYear)} />
                <Field k="تاريخ التسجيل الأصلي" v={caseQ.data.originalRegistrationDate} />
                <Field k="الجهة العامة" v={caseQ.data.publicEntityName} />
                <Field k="الصفة"  v={PUBLIC_ENTITY_POSITION_LABEL_AR[caseQ.data.publicEntityPosition]} />
                <Field k="الخصم" v={caseQ.data.opponentName} />
                <Field k="حالة دورة الحياة" v={LIFECYCLE_LABEL_AR[caseQ.data.lifecycleStatus]} />
                <Field
                  k="المرحلة الحالية"
                  v={caseQ.data.currentStageId ? `#${caseQ.data.currentStageId}` : '—'}
                />
                <Field
                  k="المالك الحالي"
                  v={lawyerLabel(caseQ.data.currentOwnerUserId, lawyersQ.data)}
                />
              </dl>
            )}
          </CardBody>
        </Card>

        {showActionsCard && (
          <Card>
            <CardHeader>
              <CardTitle>أفعال على مستوى الدعوى</CardTitle>
            </CardHeader>
            <CardBody className="space-y-3">
              <p className="text-xs text-slate-500">
                تظهر الأزرار فقط للمستخدمين المخوّلين وفق D-027 (نقل الملف إلى الاستئناف)
                و D-030 (نقل الملف إلى التنفيذ). المنع الحقيقي على الخادم.
              </p>

              <div className="flex flex-wrap gap-2">
                {canEditCaseBasicData(user, caseQ.data ?? null) && (
                  <Button
                    variant="secondary"
                    onClick={() => setEditBasicOpen(true)}
                  >
                    تعديل البيانات الأساسية
                  </Button>
                )}
                {canPromoteToAppeal(user) && (
                  <Button
                    variant="secondary"
                    disabled={promoteAppealMut.isPending}
                    onClick={() => promoteAppealMut.mutate()}
                  >
                    {promoteAppealMut.isPending ? <Spinner /> : null}
                    <span>نقل الملف إلى الاستئناف</span>
                  </Button>
                )}
                {/* Customer feedback round-2: "نقل الملف إلى الصلح" — same gating
                    as promote-to-appeal, server-side validation is authoritative. */}
                {canPromoteToConciliation(user) && (
                  <Button
                    variant="secondary"
                    disabled={promoteConcilMut.isPending}
                    onClick={() => promoteConcilMut.mutate()}
                  >
                    {promoteConcilMut.isPending ? <Spinner /> : null}
                    <span>نقل الملف إلى الصلح</span>
                  </Button>
                )}
                {canPromoteToExecution(user) && (
                  <Button
                    variant="secondary"
                    onClick={() => setPromoteExecOpen(true)}
                  >
                    نقل الملف إلى التنفيذ
                  </Button>
                )}
                {canCorrect && (
                  <Button
                    variant="secondary"
                    onClick={() => setCorrectOpen(true)}
                  >
                    تصحيح بيانات الدعوى المفصولة
                  </Button>
                )}
              </div>
            </CardBody>
          </Card>
        )}
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>المراحل</CardTitle>
        </CardHeader>
        <CardBody>
          {stagesQ.isLoading && <Spinner className="text-brand-600" />}
          {stagesQ.isError && (
            <p className="text-sm text-red-600">
              {extractApiErrorMessage(stagesQ.error, 'تعذّر تحميل المراحل.')}
            </p>
          )}
          {stagesQ.data && stagesQ.data.length === 0 && (
            <p className="text-sm text-slate-500">لا توجد مراحل.</p>
          )}
          {stagesQ.data && stagesQ.data.length > 0 && (
            <Table>
              <THead>
                <TR>
                  <TH>المعرّف</TH>
                  <TH>النوع</TH>
                  <TH>رقم الأساس</TH>
                  <TH>السنة</TH>
                  <TH>المحامي المُسنَد</TH>
                  <TH>الحالة</TH>
                  <TH>للقراءة فقط؟</TH>
                  <TH className="text-end">إجراء</TH>
                </TR>
              </THead>
              <TBody>
                {stagesQ.data.map((s) => (
                  <TR key={s.id}>
                    <TD>{s.id}</TD>
                    <TD>{STAGE_TYPE_LABEL_AR[s.stageType]}</TD>
                    <TD>{s.stageBasisNumber}</TD>
                    <TD>{s.stageYear}</TD>
                    <TD>{lawyerLabel(s.assignedLawyerUserId, lawyersQ.data)}</TD>
                    <TD>{STAGE_STATUS_LABEL_AR[s.stageStatus]}</TD>
                    <TD>{s.readOnly ? 'نعم' : 'لا'}</TD>
                    <TD className="text-end">
                      <Link to={`/stages/${s.id}`}>
                        <Button size="sm" variant="secondary">فتح المرحلة</Button>
                      </Link>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>

      <PromoteExecutionModal
        open={promoteExecOpen}
        onClose={() => { setPromoteExecOpen(false); promoteExecMut.reset(); setActionError(null); }}
        onSubmit={(body) => promoteExecMut.mutate(body)}
        submitting={promoteExecMut.isPending}
        error={promoteExecMut.isError ? extractApiErrorMessage(promoteExecMut.error) : null}
        // PR-8 (customer feedback C-3): pre-fill the form from the source case
        // so the user only confirms / tweaks instead of re-typing everything.
        prefill={caseQ.data ?? null}
      />

      {/* Mini-Phase A — Assign Lawyer (D-046). Hidden by the section itself
          when the user is not authorized for this case's (branch, dept). */}
      {caseQ.data && <AssignLawyerSection litigationCase={caseQ.data} />}

      {caseQ.data && (
        <EditCaseBasicDataModal
          open={editBasicOpen}
          onClose={() => setEditBasicOpen(false)}
          litigationCase={caseQ.data}
          currentStage={currentStage}
        />
      )}

      {/* PR-11 (customer feedback C-6 / blueprint C-6): section-head correction
          of finalized case + decision. Rights belong to the CURRENT stage's
          owning section per Q-D — they transfer on promotion. */}
      {caseQ.data && currentStage && (
        <CorrectFinalizedCaseModal
          open={correctOpen}
          onClose={() => setCorrectOpen(false)}
          litigationCase={caseQ.data}
          currentStage={currentStage}
        />
      )}

      {/* Phase 10 — reminders on this case (D-037 + PR-8b oversight extension).
          Lawyers see + author their own. Managers see all reminders read-only. */}
      <RemindersSection caseId={caseId} />
    </>
  );
}

function Field({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{k}</dt>
      <dd className="mt-0.5 text-slate-800">{v}</dd>
    </div>
  );
}

// ---------- Promote-to-execution modal ----------

const promoteExecSchema = z.object({
  enforcingEntityName: z.string().min(1).max(200),
  executedAgainstName: z.string().min(1).max(200),
  executionFileType:   z.string().min(1).max(64),
  executionFileNumber: z.string().min(1).max(64),
  executionYear:       z.coerce.number().int().min(1900).max(2100),
});
type PromoteExecForm = z.infer<typeof promoteExecSchema>;

function PromoteExecutionModal({
  open, onClose, onSubmit, submitting, error, prefill,
}: {
  open: boolean; onClose: () => void;
  onSubmit: (body: PromoteToExecutionRequest) => void;
  submitting: boolean;
  error?: string | null;
  /** PR-8 (C-3): source case used to pre-fill the form. */
  prefill: { publicEntityName: string; opponentName: string;
             originalBasisNumber: string; basisYear: number } | null;
}) {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<PromoteExecForm>({
    resolver: zodResolver(promoteExecSchema),
  });

  // PR-8 (C-3): when the modal opens (or the source case changes), seed the
  // form with the case's basic data so the user only confirms / adjusts.
  // Mappings per customer feedback page 4:
  //   الجهة المنفِّذة     ← case.publicEntityName
  //   المنفَّذ ضدّه       ← case.opponentName
  //   نوع الملف التنفيذي ← "حكم"  (most common; user can override)
  //   رقم الملف التنفيذي ← EX-{originalBasisNumber}/{basisYear}  (suggested)
  //   السنة              ← current year
  useEffect(() => {
    if (open && prefill) {
      reset({
        enforcingEntityName: prefill.publicEntityName,
        executedAgainstName: prefill.opponentName,
        executionFileType:   'حكم',
        executionFileNumber: `EX-${prefill.originalBasisNumber}/${prefill.basisYear}`,
        executionYear:       new Date().getFullYear(),
      });
    }
  }, [open, prefill, reset]);

  return (
    <Modal
      open={open}
      onClose={() => { reset(); onClose(); }}
      title="نقل الدعوى إلى ملف تنفيذي"
      footer={
        <>
          <Button
            type="submit" form="promote-exec-form" disabled={submitting}
          >
            {submitting ? <Spinner /> : null}
            <span>إنشاء ملف تنفيذي</span>
          </Button>
          <Button variant="ghost" onClick={() => { reset(); onClose(); }}>إلغاء</Button>
        </>
      }
    >
      {error && (
        <div role="alert" className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      <form
        id="promote-exec-form"
        className="space-y-3"
        onSubmit={handleSubmit((v) => onSubmit({
          ...v,
          executionYear: Number(v.executionYear),
        }))}
      >
        <Labeled label="الجهة المنفِّذة" error={errors.enforcingEntityName?.message}>
          <Input {...register('enforcingEntityName')} />
        </Labeled>
        <Labeled label="المنفَّذ ضدّه" error={errors.executedAgainstName?.message}>
          <Input {...register('executedAgainstName')} />
        </Labeled>
        <Labeled label="نوع الملف التنفيذي" error={errors.executionFileType?.message}>
          <Input {...register('executionFileType')} />
        </Labeled>
        <Labeled label="رقم الملف التنفيذي" error={errors.executionFileNumber?.message}>
          <Input {...register('executionFileNumber')} />
        </Labeled>
        <Labeled label="السنة" error={errors.executionYear?.message}>
          <Input type="number" {...register('executionYear')} />
        </Labeled>
      </form>
    </Modal>
  );
}

function Labeled({
  label, error, children,
}: {
  label: string; error?: string; children: ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}


