import { Link } from 'react-router-dom';
import { Button } from '@/shared/ui/Button';

export function NotFoundPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-10 text-center">
      <h1 className="text-2xl font-semibold text-slate-800">الصفحة غير موجودة</h1>
      <p className="text-sm text-slate-500">المسار المطلوب لا يقابل أي صفحة معتمدة.</p>
      <Link to="/dashboard">
        <Button variant="secondary">العودة للرئيسية</Button>
      </Link>
    </div>
  );
}

