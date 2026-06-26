import Link from 'next/link';

/** Standard back navigation link for rider sub-pages. */
export default function RiderBackLink({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="mb-6 inline-flex min-h-[44px] items-center gap-1 text-sm font-medium text-[#1E3A8A] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A8A] rounded"
    >
      ← {label}
    </Link>
  );
}