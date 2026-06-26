import { Fragment } from 'react';

/** Trip statuses that map to timeline progress. */
export type TripTimelineStatus =
  | 'open'
  | 'pending_assignment'
  | 'assigned'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export type TimelineStepKey = 'booked' | 'assigned' | 'en_route' | 'completed';

export type TimelineStep = {
  key: TimelineStepKey;
  label: string;
};

export const DEFAULT_TIMELINE_STEPS: TimelineStep[] = [
  { key: 'booked', label: 'Booked' },
  { key: 'assigned', label: 'Driver assigned' },
  { key: 'en_route', label: 'En route' },
  { key: 'completed', label: 'Completed' },
];

export interface TripTimelineProps {
  /** Current trip status — drives which step is active. */
  status: TripTimelineStatus | string;
  /** Optional pickup time (ISO) — shown under the assigned step when relevant. */
  pickupTime?: string | null;
  /** Optional booking time (ISO) — shown under the booked step when relevant. */
  createdAt?: string | null;
  /** Override default steps (e.g. future org-trip variants). */
  steps?: TimelineStep[];
  /** Section title when `showTitle` is true. */
  title?: string;
  /** Show the section title above the timeline. */
  showTitle?: boolean;
  /**
   * `default` — card wrapper with border and padding (trip detail).
   * `inline` — timeline only (dashboard cards, list rows).
   */
  variant?: 'default' | 'inline';
  className?: string;
}

// Phase 2: ETA badges per step; clickable step details; enter/exit animations

function formatStepTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Maps backend trip status to the active timeline step index (0-based). */
export function timelineStepIndex(status: string): number {
  switch (status) {
    case 'open':
    case 'pending_assignment':
      return 0;
    case 'assigned':
      return 1;
    case 'in_progress':
      return 2;
    case 'completed':
      return 3;
    default:
      return -1;
  }
}

function stepSubtitle(
  stepKey: TimelineStepKey,
  pickupTime?: string | null,
  createdAt?: string | null
): string | null {
  if (stepKey === 'booked' && createdAt) {
    return `Requested ${formatStepTime(createdAt)}`;
  }
  if (stepKey === 'assigned' && pickupTime) {
    return `Pickup ${formatStepTime(pickupTime)}`;
  }
  return null;
}

function CancelledState() {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
      This trip was cancelled.
    </div>
  );
}

export default function TripTimeline({
  status,
  pickupTime,
  createdAt,
  steps = DEFAULT_TIMELINE_STEPS,
  title = 'Trip progress',
  showTitle = false,
  variant = 'inline',
  className = '',
}: TripTimelineProps) {
  if (status === 'cancelled') {
    const cancelled = <CancelledState />;
    if (variant === 'default') {
      return (
        <div
          className={`rounded-2xl border border-blue-200 bg-white p-5 shadow-sm ${className}`.trim()}
        >
          {showTitle && (
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-blue-800">
              {title}
            </h2>
          )}
          {cancelled}
        </div>
      );
    }
    return <div className={className}>{cancelled}</div>;
  }

  const activeIdx = timelineStepIndex(status);
  const progressPercent =
    activeIdx >= 0 ? Math.round((activeIdx / Math.max(steps.length - 1, 1)) * 100) : 0;

  const timeline = (
    <div>
      {/* Mobile-friendly progress bar */}
      <div
        className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-blue-100 sm:hidden"
        role="progressbar"
        aria-valuenow={progressPercent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Trip progress"
      >
        <div
          className="h-full rounded-full bg-[#1E3A8A] transition-all duration-300"
          style={{ width: `${Math.max(progressPercent, activeIdx === 0 ? 8 : progressPercent)}%` }}
        />
      </div>

      <ol className="flex w-full items-start">
        {steps.map((step, idx) => {
          const isComplete = activeIdx >= 0 && idx < activeIdx;
          const isCurrent = idx === activeIdx;
          const isUpcoming = activeIdx >= 0 && idx > activeIdx;
          const subtitle = stepSubtitle(step.key, pickupTime, createdAt);
          const showSubtitle =
            subtitle && (isCurrent || (step.key === 'booked' && isComplete) || step.key === 'assigned');

          return (
            <Fragment key={step.key}>
              {idx > 0 && (
                <li
                  aria-hidden
                  className={`mt-4 h-0.5 min-w-[6px] flex-1 ${
                    idx <= activeIdx ? 'bg-[#1E3A8A]' : 'bg-blue-100'
                  }`}
                />
              )}
              <li
                className="flex min-w-0 flex-col items-center text-center"
                style={{ flex: idx === 0 || idx === steps.length - 1 ? '0 0 auto' : '1 1 0' }}
                aria-current={isCurrent ? 'step' : undefined}
              >
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold sm:h-9 sm:w-9 ${
                    isComplete
                      ? 'bg-[#1E3A8A] text-white'
                      : isCurrent
                        ? 'bg-[#1E3A8A] text-white ring-4 ring-blue-100'
                        : 'bg-blue-100 text-blue-600'
                  }`}
                >
                  {isComplete ? (
                    <span aria-hidden className="text-sm leading-none">
                      ✓
                    </span>
                  ) : (
                    <span aria-hidden>{idx + 1}</span>
                  )}
                </div>
                <span
                  className={`mt-2 max-w-[4.5rem] text-[10px] font-medium leading-tight sm:max-w-none sm:text-xs ${
                    isCurrent ? 'text-blue-950' : isUpcoming ? 'text-blue-500' : 'text-blue-700'
                  }`}
                >
                  {step.label}
                </span>
                {showSubtitle && (
                  <span className="mt-0.5 hidden max-w-[5.5rem] text-[9px] text-blue-600 sm:block sm:max-w-[7rem] sm:text-[10px]">
                    {subtitle}
                  </span>
                )}
              </li>
            </Fragment>
          );
        })}
      </ol>
    </div>
  );

  if (variant === 'default') {
    return (
      <div
        className={`rounded-2xl border border-blue-200 bg-white p-5 shadow-sm ${className}`.trim()}
      >
        {showTitle && (
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-blue-800">
            {title}
          </h2>
        )}
        {timeline}
      </div>
    );
  }

  return <div className={className}>{timeline}</div>;
}