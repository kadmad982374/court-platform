// Customer feedback round-2: an explicit "Delete user" button.
//
// Backend semantics: soft-delete (sets active=false). The user can no
// longer log in, their data is preserved, and self-delete is rejected
// server-side. The UI shows a confirm dialog explaining the effect.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/shared/ui/Button';
import { Modal } from '@/shared/ui/Modal';
import { Spinner } from '@/shared/ui/Spinner';
import { extractApiErrorMessage } from '@/shared/lib/apiError';

import { useDeleteUser } from '../hooks/useUsersAdmin';

interface Props {
  userId: number;
  username: string;
  fullName: string;
  active: boolean;
  /** If true, navigate to /admin/users after successful delete. */
  redirectAfter?: boolean;
  /** Visual variant — danger button on the detail page, ghost link on list rows. */
  asListAction?: boolean;
}

export function DeleteUserButton({
  userId, username, fullName, active, redirectAfter = false, asListAction = false,
}: Props) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const mut = useDeleteUser();

  const onConfirm = () => {
    setErrorMsg(null);
    mut.mutate(userId, {
      onSuccess: () => {
        setOpen(false);
        if (redirectAfter) navigate('/admin/users');
      },
      onError: (e) => setErrorMsg(extractApiErrorMessage(e)),
    });
  };

  // Already deactivated → render a disabled hint instead of a misleading button.
  if (!active) {
    return (
      <span className="text-xs text-slate-400">معطَّل</span>
    );
  }

  const trigger = asListAction ? (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="text-xs text-red-600 hover:text-red-800 hover:underline"
      data-testid={`admin-user-delete-${userId}`}
    >
      حذف
    </button>
  ) : (
    <Button
      type="button"
      variant="secondary"
      onClick={() => setOpen(true)}
      className="border-red-300 text-red-700 hover:bg-red-50"
      data-testid={`admin-user-delete-${userId}`}
    >
      حذف المستخدم
    </Button>
  );

  return (
    <>
      {trigger}

      <Modal
        open={open}
        onClose={() => { setOpen(false); setErrorMsg(null); mut.reset(); }}
        title="تأكيد حذف المستخدم"
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={onConfirm}
              disabled={mut.isPending}
              className="border-red-300 text-red-700 hover:bg-red-50"
              data-testid="admin-user-delete-confirm"
            >
              {mut.isPending ? <Spinner /> : null}
              <span>تأكيد الحذف</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => { setOpen(false); setErrorMsg(null); mut.reset(); }}
              disabled={mut.isPending}
            >
              إلغاء
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-sm text-slate-700">
          <p>
            هل تريد حذف المستخدم{' '}
            <strong>{fullName}</strong> (<span dir="ltr">@{username}</span>)؟
          </p>
          <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            سيتم تعطيل الحساب — لن يستطيع المستخدم تسجيل الدخول. تبقى البيانات
            المرتبطة (الدعاوى، السجلات، الإسناد) محفوظة. يمكن إعادة التفعيل لاحقاً
            من نموذج «البيانات الأساسية».
          </p>
          {errorMsg && (
            <p role="alert" className="text-sm text-red-600">{errorMsg}</p>
          )}
        </div>
      </Modal>
    </>
  );
}
