import Link from 'next/link';
import { riderPrimaryButtonClass } from '@/lib/rider/ui';

/** Consistent empty-state card for lists and tabs. */
export default function RiderEmptyState({
  title,
  description,
  actionLabel,
  actionHref,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-blue-200 bg-blue-50/50 px-6 py-10 text-center">
      <p className="text-lg font-semibold text-blue-950">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-blue-800">{description}</p>
      {actionLabel && actionHref && (
        <Link href={actionHref} className={`mt-6 ${riderPrimaryButtonClass}`}>
          {actionLabel}
        </Link>
      )}
    </div>
  );
}