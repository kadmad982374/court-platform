// Mini-Phase A — Assign Lawyer (D-046).
//
// Self-contained section embedded into CaseDetailPage. Responsibilities:
//   1. Show only when the current user is authorized to assign a lawyer for
//      this specific case (visual gate via canAssignLawyerForCase; backend is
//      the real authority).
//   2. Fetch the eligible lawyer list via GET /api/v1/users (D-046) scoped to
//      the case's (createdBranchId, createdDepartmentId).
//   3. Submit POST /cases/{id}/assign-lawyer with the picked lawyerUserId.
//   4. Display the current owner as the lawyer's full name when the list is
//      available (replaces the previous "#userId" placeholder).
//
// Reference:
//   docs/project/BACKEND_GAP_PHASE11_ASSIGN_LAWYER.md
//   docs/project/PROJECT_ASSUMPTIONS_AND_DECISIONS.md (D-046)
//
// Out of scope here (Mini-Phase A):
//   - Creating/editing users (Mini-Phase B).
//   - Cross-department lawyer search.
//   - Manual numeric userId input — explicitly forbidden by the spec.

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/AuthContext';
import { canAssignLawyerForCase } from '@/features/auth/permissions';
import { Button } from '@/shared/ui/Button';
import { Card, CardBody, CardHeader, CardTitle } from '@/shared/ui/Card';
import { Select } from '@/shared/ui/FormFields';
import { Spinner } from '@/shared/ui/Spinner';
import { extractApiErrorMessage } from '@/shared/lib/apiError';
import {
  listAssignableLawyers,
  type AssignableLawyerOption,
} from '@/shared/api/users';
import type { LitigationCase } from '@/shared/types/domain';
import { assignLawyer } from './api';

interface Props {
  litigationCase: LitigationCase;
}

/**
 * Resolve the display label for a lawyer userId from a fetched list.
 * Falls back to "#id" when the list is not yet loaded or the id is not
 * within scope (e.g., previously-assigned lawyer no longer active).
 */
export function lawyerLabel(
  userId: number | null,
  options: AssignableLawyerOption[] | undefined,
): string {
  if (userId == null) return '— (لا مالك)';
  const hit = options?.find((o) => o.id === userId);
  return hit ? hit.fullName : `#${userId}`;
}

export function AssignLawyerSection({ litigationCase }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const allowed = canAssignLawyerForCase(user, litigationCase);

  const lawyersQ = useQuery({
    queryKey: [
      'lookup', 'assignable-lawyers',
      litigationCase.createdBranchId, litigationCase.createdDepartmentId,
    ],
    queryFn: () => listAssignableLawyers(
      litigationCase.createdBranchId, litigationCase.createdDepartmentId,
    ),
    enabled: allowed,
    staleTime: 30_000,
  });

  const [pickedId, setPickedId] = useState<string>('');

  const mut = useMutation({
    mutationFn: (lawyerUserId: number) => assignLawyer(litigationCase.id, lawyerUserId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['cases', litigationCase.id] });
      void qc.invalidateQueries({ queryKey: ['cases', litigationCase.id, 'stages'] });
      setPickedId('');
    },
  });

  const ownerLabel = useMemo(
    () => lawyerLabel(litigationCase.currentOwnerUserId, lawyersQ.data),
    [litigationCase.currentOwnerUserId, lawyersQ.data],
  );

  if (!allowed) return null;

  const isReassign = litigationCase.currentOwnerUserId != null;
  const submitDisabled =
    !pickedId
    || mut.isPending
    || (isReassign && Number(pickedId) === litigationCase.currentOwnerUserId);

  return (
    <Card className="mt-4" data-testid="assign-lawyer-section">
      <CardHeader>
        <CardTitle>{isReassign ? 'تغيير المحامي المُسنَد' : 'إسناد محامٍ'}</CardTitle>
      </CardHeader>
      <CardBody className="space-y-3">
        <p className="text-xs text-slate-500">
          القائمة محصورة بمحامي نفس القسم/الفرع المسجَّلة فيه الدعوى (D-046).
          الخادم هو السلطة النهائية على قبول الإسناد.
        </p>

        <dl className="text-sm">
          <dt className="text-xs text-slate-500">المالك الحالي</dt>
          <dd className="mt-0.5 text-slate-800" data-testid="current-owner-label">
            {ownerLabel}
          </dd>
        </dl>

        {lawyersQ.isLoading && (
          <div className="flex items-center gap-2 text-sm text-slate-500" role="status">
            <Spinner /> <span>جارٍ تحميل قائمة المحامين…</span>
          </div>
        )}
        {lawyersQ.isError && (
          <p role="alert" className="text-sm text-red-600">
            {extractApiErrorMessage(lawyersQ.error)}
          </p>
        )}

        {lawyersQ.data && lawyersQ.data.length === 0 && (
          <p className="text-sm text-amber-700">
            لا يوجد محامون مؤهَّلون لهذا القسم. تواصل مع الإدارة لإضافة محامٍ
            (يتطلب Mini-Phase B).
          </p>
        )}

        {lawyersQ.data && lawyersQ.data.length > 0 && (
          <div className="flex flex-wrap items-end gap-2">
            <label className="block text-sm">
              <span className="mb-1 block text-slate-700">اختر محاميًا</span>
              <Select
                value={pickedId}
                onChange={(e) => setPickedId(e.target.value)}
                aria-label="lawyer-picker"
              >
                <option value="">— اختر —</option>
                {lawyersQ.data.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.fullName}{' '}
                    {l.id === litigationCase.currentOwnerUserId ? '(الحالي)' : ''}
                  </option>
                ))}
              </Select>
            </label>

            <Button
              onClick={() => mut.mutate(Number(pickedId))}
              disabled={submitDisabled}
              data-testid="assign-lawyer-submit"
            >
              {mut.isPending ? <Spinner /> : null}
              <span>{isReassign ? 'تأكيد التغيير' : 'تأكيد الإسناد'}</span>
            </Button>
          </div>
        )}

        {mut.isError && (
          <p role="alert" className="text-sm text-red-600" data-testid="assign-lawyer-error">
            {extractApiErrorMessage(mut.error)}
          </p>
        )}
        {mut.isSuccess && !mut.isPending && (
          <p className="text-sm text-emerald-700" data-testid="assign-lawyer-success">
            تم الإسناد بنجاح.
          </p>
        )}
      </CardBody>
    </Card>
  );
}

