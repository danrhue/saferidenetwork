/**
 * Shared Tailwind class tokens for consistent Rider Portal styling.
 * Import these instead of duplicating strings across pages.
 */

export const riderInputClass =
  'w-full rounded-xl border border-blue-200 px-4 py-3 text-blue-950 placeholder:text-blue-400 focus:border-[#1E3A8A] focus:outline-none focus:ring-2 focus:ring-blue-200';

export const riderTextareaClass = `${riderInputClass} resize-y min-h-[100px]`;

export const riderLabelClass = 'mb-2 block text-sm font-semibold text-blue-950';

export const riderCardClass = 'rounded-2xl border border-blue-200 bg-white p-6 shadow-sm';

export const riderPrimaryButtonClass =
  'inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[#1E3A8A] px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A8A] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60';

export const riderSecondaryButtonClass =
  'inline-flex min-h-[44px] items-center justify-center rounded-xl border border-blue-200 px-6 py-3 text-sm font-medium text-blue-950 transition hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-200';

export const riderDangerButtonClass =
  'inline-flex min-h-[44px] items-center justify-center rounded-xl border border-red-200 px-5 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-200 disabled:opacity-50';