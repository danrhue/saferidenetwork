/**
 * Rider pickup scheduling — ASAP vs scheduled, copy, and time helpers.
 */

export type ScheduleMode = 'asap' | 'scheduled';

/** Target pickup window for ASAP requests (not a guarantee). */
export const ASAP_PICKUP_BUFFER_MINUTES = 25;

export function getAsapPickupIso(): string {
  const target = new Date();
  target.setMinutes(target.getMinutes() + ASAP_PICKUP_BUFFER_MINUTES);
  const remainder = target.getMinutes() % 5;
  if (remainder !== 0) {
    target.setMinutes(target.getMinutes() + (5 - remainder));
  }
  target.setSeconds(0, 0);
  return target.toISOString();
}

export function formatScheduleLabel(mode: ScheduleMode, pickupTimeIso: string | null): string {
  if (mode === 'asap') return 'As soon as possible';
  if (!pickupTimeIso) return 'Scheduled pickup';
  return new Date(pickupTimeIso).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export const ASAP_EXPECTATIONS = {
  title: 'As soon as possible',
  summary:
    'We will match the closest available independent contractor driver as soon as one accepts your trip.',
  points: [
    'We do not guarantee immediate pickup.',
    'Safe Ride Network connects you with independent contractor drivers — availability varies by time and location.',
    'The closest available driver will be assigned as soon as possible once your trip is paid and published.',
    'Immediate requests may take longer during peak times, bad weather, or in less-served areas.',
  ],
  reassurance:
    'You will receive updates in the Rider Portal as soon as a driver is matched. Scheduled pickups typically offer more predictable timing.',
} as const;

export const SCHEDULED_EXPECTATIONS = {
  title: 'Scheduled pickup',
  summary:
    'Your driver is expected to arrive at the pickup location at or near your selected time.',
  points: [
    'Drivers are independent contractors — slight variations may occur due to traffic or prior trips.',
    'We will notify you when a driver is assigned and when they are en route.',
  ],
} as const;

export const CONTRACTOR_DISCLAIMER =
  'All rides are fulfilled by independent contractor drivers, not Safe Ride Network employees.';