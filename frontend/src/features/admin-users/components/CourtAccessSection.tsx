// UI sub-phase B — CourtAccessSection.
// Add a court grant + revoke (logical delete on backend).

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { Card, CardBody, CardHeader, CardTitle } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';
import { Select } from '@/shared/ui/FormFields';
import { Spinner } from '@/shared/ui/Spinner';
import { Table, TBody, TD, TH, THead, TR } from '@/shared/ui/Table';
import { extractApiErrorMessage } from '@/shared/lib/apiError';
import { listBranches, listCourts } from '@/shared/api/lookups';
import type { CourtAccess } from '@/shared/types/domain';

import {
  useAddCourtAccess,
  useRemoveCourtAccess,
} from '../hooks/useUsersAdmin';

const schema = z.object({
  branchId: z.coerce.number().int().positive('اختر الفرع'),
  courtId:  z.coerce.number().int().positive('اختر المحكمة'),
});
type Values = z.infer<typeof schema>;

interface Props {
  userId: number;
  courtAccess: CourtAccess[];
}

export function CourtAccessSection({ userId, courtAccess }: Props) {
  const branchesQ = useQuery({ queryKey: ['lookup', 'branches'], queryFn: listBranches });

  const {
    register, handleSubmit, watch, reset,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  const branchId = watch('branchId');
  const courtsQ = useQuery({
    queryKey: ['lookup', 'courts-all', branchId],
    queryFn: () => listCourts({ branchId: Number(branchId) }),
    enabled: !!branchId,
  });

  const visibleBranches = useMemo(
    () => (branchesQ.data ?? []).filter((b) => b.active),
    [branchesQ.data],
  );
  const visibleCourts = useMemo(
    () => (courtsQ.data ?? []).filter((c) => c.active),
    [courtsQ.data],
  );

  const addM = useAddCourtAccess(userId);
  const remM = useRemoveCourtAccess(userId);
  const [opError, setOpError] = useState<string | null>(null);

  const onAdd = (v: Values) => {
    setOpError(null);
    addM.mutate({ courtId: Number(v.courtId) }, {
      onSuccess: () => reset({ branchId: 0 as unknown as number, courtId: 0 as unknown as number }),
      onError:   (e) => setOpError(extractApiErrorMessage(e)),
    });
  };

  const onRevoke = (caid: number) => {
    setOpError(null);
    remM.mutate(caid, { onError: (e) => setOpError(extractApiErrorMessage(e)) });
  };

  const activeAccess = courtAccess.filter((c) => c.active);

  return (
    <Card data-testid="admin-court-access-section">
      <CardHeader>
        <CardTitle>الوصول إلى المحاكم</CardTitle>
      </CardHeader>
      <CardBody className="space-y-4">
        <p className="text-xs text-slate-500">
          الإلغاء حذف منطقي (يُعيِّن السجل غير نشط مع حفظ سجل التدقيق).
          الخادم يرفض المحاكم خارج صلاحية المُجري (D-048 / scope).
        </p>

        {activeAccess.length === 0 ? (
          <p className="text-sm text-slate-500">لا وصول مسجَّل لمحاكم.</p>
        ) : (
          <Table data-testid="admin-court-access-table">
            <THead>
              <TR>
                <TH>المحكمة</TH>
                <TH>تاريخ المنح</TH>
                <TH>إجراء</TH>
              </TR>
            </THead>
            <TBody>
              {activeAccess.map((c) => (
                <TR key={c.id}>
                  <TD>#{c.courtId}</TD>
                  <TD>{c.grantedAt}</TD>
                  <TD>
                    <button
                      type="button"
                      className="text-xs text-red-700 hover:underline"
                      aria-label={`revoke-court-${c.id}`}
                      disabled={remM.isPending}
                      onClick={() => onRevoke(c.id)}
                    >
                      إلغاء
                    </button>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}

        <form
          onSubmit={handleSubmit(onAdd)}
          className="flex flex-wrap items-end gap-2"
          data-testid="admin-court-access-add-form"
        >
          <label className="block text-sm">
            <span className="mb-1 block text-slate-700">الفرع</span>
            <Select aria-label="court-branch" {...register('branchId')}>
              <option value="">— اختر —</option>
              {visibleBranches.map((b) => (
                <option key={b.id} value={b.id}>{b.nameAr}</option>
              ))}
            </Select>
            {errors.branchId && (
              <p className="mt-1 text-xs text-red-600">{errors.branchId.message}</p>
            )}
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-700">المحكمة</span>
            <Select aria-label="court-id" disabled={!branchId} {...register('courtId')}>
              <option value="">— اختر —</option>
              {visibleCourts.map((c) => (
                <option key={c.id} value={c.id}>{c.nameAr}</option>
              ))}
            </Select>
            {errors.courtId && (
              <p className="mt-1 text-xs text-red-600">{errors.courtId.message}</p>
            )}
          </label>
          <Button type="submit" disabled={isSubmitting || addM.isPending}>
            {addM.isPending ? <Spinner /> : null}
            <span>منح الوصول</span>
          </Button>
        </form>

        {opError && (
          <p
            role="alert"
            className="text-sm text-red-600"
            data-testid="admin-court-access-error"
          >
            {opError}
          </p>
        )}
      </CardBody>
    </Card>
  );
}

