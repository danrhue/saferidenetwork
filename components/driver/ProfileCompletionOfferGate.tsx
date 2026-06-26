import Link from 'next/link';
import { AlertCircle } from 'lucide-react';
import type { IncompleteOfferRequirement } from '@/lib/driver/incomplete-requirements';
import { PROFILE_WIZARD_PATH } from '@/lib/driver/wizard-steps';

type ProfileCompletionOfferGateProps = {
  profileCompletion: number;
  incompleteRequirements: IncompleteOfferRequirement[];
  compact?: boolean;
};

function statusTone(status: string): string {
  const lower = status.toLowerCase();
  if (lower.includes('pending')) return 'bg-amber-100 text-amber-800';
  if (lower.includes('rejected') || lower.includes('missing')) return 'bg-red-100 text-red-800';
  if (lower.includes('not uploaded')) return 'bg-orange-100 text-orange-800';
  return 'bg-gray-100 text-gray-700';
}

export default function ProfileCompletionOfferGate({
  profileCompletion,
  incompleteRequirements,
  compact = false,
}: ProfileCompletionOfferGateProps) {
  const firstWizardStep = incompleteRequirements.find((r) => r.wizardStep)?.wizardStep;
  const resumeHref = firstWizardStep
    ? `${PROFILE_WIZARD_PATH}?step=${firstWizardStep}`
    : PROFILE_WIZARD_PATH;

  return (
    <div
      className={`rounded-2xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50 ${
        compact ? 'p-4' : 'p-6'
      }`}
      role="alert"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-3">
            <AlertCircle
              className="mt-0.5 h-6 w-6 shrink-0 text-amber-700"
              strokeWidth={2}
              aria-hidden
            />
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-amber-900">
                Offers blocked until profile is 100%
              </p>
              <h2 className={`mt-1 font-bold text-amber-950 ${compact ? 'text-lg' : 'text-xl'}`}>
                Complete the items below to start making offers
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-amber-900">
                You are at <strong>{profileCompletion}%</strong> completion. Trip offers unlock
                once every profile and compliance requirement is finished.
              </p>
            </div>
          </div>

          {incompleteRequirements.length > 0 && (
            <div className="mt-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
                What you still need
              </p>
              <ul className="mt-3 space-y-2">
                {incompleteRequirements.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      className="flex flex-col gap-2 rounded-xl border border-amber-200/80 bg-white/80 px-4 py-3 transition hover:border-amber-300 hover:bg-white sm:flex-row sm:items-center sm:justify-between"
                    >
                      <span className="font-medium text-amber-950">{item.label}</span>
                      <span
                        className={`inline-flex self-start rounded-full px-2.5 py-0.5 text-xs font-semibold sm:self-auto ${statusTone(item.status)}`}
                      >
                        {item.status}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {!compact && (
          <div className="shrink-0 text-center sm:text-right">
            <div className="text-4xl font-bold text-amber-900">{profileCompletion}%</div>
            <div className="text-xs font-medium text-amber-800">of 100% required</div>
          </div>
        )}
      </div>

      <div className={`${compact ? 'mt-4' : 'mt-6'}`}>
        <Link
          href={resumeHref}
          className="inline-flex w-full items-center justify-center rounded-xl bg-[#1E3A8A] px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-900 sm:w-auto"
        >
          Go to Profile Wizard →
        </Link>
      </div>
    </div>
  );
}