import { Link } from 'react-router-dom';
import { BookOpen, FileText, Gavel, Scale } from 'lucide-react';
import type { ComponentType } from 'react';
import { Card, CardBody } from '@/shared/ui/Card';
import { PageHeader } from '@/shared/ui/PageHeader';

/**
 * «قسم الدراسات والمنازعات الخارجية» hub (client feedback #5).
 *
 * Groups the reference modules that used to be flat sidebar items
 * (المكتبة القانونية, التعاميم) together with two new entries:
 *   - القرارات الإدارية  (content pending — placeholder for now)
 *   - المنازعات الخارجية (register; wired in Phase 2 to /external-disputes)
 *
 * دليل الجهات العامة stays a top-level مرجعيات entry, so it is NOT listed here.
 */
interface HubEntry {
  label: string;
  description: string;
  to?: string;
  icon: ComponentType<{ className?: string }>;
}

const ENTRIES: HubEntry[] = [
  {
    label: 'المكتبة القانونية',
    description: 'القوانين والمراجع القانونية.',
    to: '/legal-library',
    icon: BookOpen,
  },
  {
    label: 'القرارات الإدارية',
    description: 'القرارات الإدارية الصادرة.',
    icon: Gavel,
  },
  {
    label: 'التعاميم',
    description: 'أحدث التعاميم الصادرة.',
    to: '/circulars',
    icon: FileText,
  },
  {
    label: 'المنازعات الخارجية',
    description: 'سجل المنازعات الخارجية.',
    to: '/external-disputes',
    icon: Scale,
  },
];

export function StudiesHubPage() {
  return (
    <>
      <PageHeader
        title="قسم الدراسات والمنازعات الخارجية"
        subtitle="المكتبة القانونية، القرارات الإدارية، التعاميم، والمنازعات الخارجية."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        {ENTRIES.map((e) => (
          <HubCard key={e.label} entry={e} />
        ))}
      </div>
    </>
  );
}

function HubCard({ entry }: { entry: HubEntry }) {
  const Icon = entry.icon;
  const inner = (
    <CardBody className="flex items-start gap-3">
      <span className="mt-0.5 rounded bg-brand-50 p-2 text-brand-600">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          {entry.label}
          {!entry.to && (
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-normal text-slate-500">
              قريباً
            </span>
          )}
        </h3>
        <p className="mt-0.5 text-xs text-slate-500">{entry.description}</p>
      </div>
    </CardBody>
  );

  if (!entry.to) {
    return <Card className="opacity-70">{inner}</Card>;
  }
  return (
    <Link
      to={entry.to}
      className="block rounded transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
    >
      <Card className="hover:border-brand-300 hover:shadow-md">{inner}</Card>
    </Link>
  );
}
