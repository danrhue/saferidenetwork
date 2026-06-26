import Link from 'next/link';
import type { IncompleteWizardStep } from '@/lib/driver/profile-completion';
import { PROFILE_WIZARD_PATH } from '@/lib/driver/wizard-steps';

type ProfileCompletionOfferGateProps = {
  profileCompletion: number;
  incompleteSteps: IncompleteWizardStep[];
  compact?: boolean;
};

export default function ProfileCompletionOfferGate({
  profileCompletion,
  incompleteSteps,
  compact = false,
}: ProfileCompletionOfferGateProps) {
  const resumeHref =
    incompleteSteps.length > 0
      ? `${PROFILE_WIZARD_PATH}?step=${incompleteSteps[0].id}`
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
          <p className="text-sm font-bold uppercase tracking-wide text-amber-900">
            Profile incomplete — offers locked
          </p>
          <h2 className={`mt-1 font-bold text-amber-950 ${compact ? 'text-lg' : 'text-xl'}`}>
            Finish your profile to start making offers
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-amber-900">
            Trip offers are available only after your driver profile and compliance reach{' '}
            <strong>100%</strong>. You are currently at{' '}
            <strong>{profileCompletion}%</strong>. Complete the remaining steps below, then return
            here to submit offers.
          </p>

          {incompleteSteps.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
                Still needed
              </p>
              <ul className="mt-2 space-y-1.5">
                {incompleteSteps.map((step) => (
                  <li key={step.id} className="flex items-center gap-2 text-sm text-amber-950">
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-200 text-xs font-bold text-amber-900"
                      aria-hidden
                    >
                      {step.id}
                    </span>
                    <span>{step.title}</span>
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

      <div className={`${compact ? 'mt-4' : 'mt-6'} flex flex-col gap-3 sm:flex-row`}>
        <Link
          href={resumeHref}
          className="inline-flex items-center justify-center rounded-xl bg-[#1E3A8A] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-900"
        >
          Continue Profile Setup →
        </Link>
        <Link
          href="/dashboard/documents"
          className="inline-flex items-center justify-center rounded-xl border border-amber-300 bg-white px-6 py-3 text-sm font-semibold text-amber-950 transition hover:bg-amber-50"
        >
          My Documents
        </Link>
      </div>
    </div>
  );
}