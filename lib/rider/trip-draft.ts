/**
 * Get a Ride conversion funnel — sessionStorage draft for signup → wizard handoff.
 * Phase 2: Supabase-backed drafts for cross-device resume.
 */

/** SessionStorage key for the Get a Ride → Rider signup conversion funnel. */
export const RIDER_TRIP_DRAFT_KEY = 'rider_trip_draft';

/** Trip details captured on the public Get a Ride page before account creation. */
export interface RiderTripDraft {
  name?: string;
  phone?: string;
  email?: string;
  pickup: string;
  dropoff: string;
  date: string;
  time: string;
  passengers: string;
  notes?: string;
  savedAt: string;
}

/** Fields on the Trip Request Wizard that can be pre-filled from a draft. */
export interface RiderWizardDraftFields {
  pickupLocation: string;
  dropoffLocation: string;
  pickupDate: string;
  pickupTime: string;
  passengers: string;
  specialInstructions: string;
}

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof sessionStorage !== 'undefined';
}

function isValidDraft(value: unknown): value is RiderTripDraft {
  if (!value || typeof value !== 'object') return false;
  const d = value as RiderTripDraft;
  return (
    typeof d.pickup === 'string' &&
    typeof d.dropoff === 'string' &&
    typeof d.date === 'string' &&
    typeof d.time === 'string' &&
    typeof d.passengers === 'string'
  );
}

/** Persist trip draft for the signup → wizard handoff. */
export function saveRiderTripDraft(draft: Omit<RiderTripDraft, 'savedAt'>): void {
  if (!isBrowser()) return;

  const payload: RiderTripDraft = {
    ...draft,
    savedAt: new Date().toISOString(),
  };

  try {
    sessionStorage.setItem(RIDER_TRIP_DRAFT_KEY, JSON.stringify(payload));
  } catch (err) {
    // Phase 2: Supabase anonymous draft storage when sessionStorage is unavailable
    console.error('Failed to save rider trip draft:', err);
  }
}

/** Read the saved trip draft, if any. */
export function getRiderTripDraft(): RiderTripDraft | null {
  if (!isBrowser()) return null;

  try {
    const raw = sessionStorage.getItem(RIDER_TRIP_DRAFT_KEY);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (!isValidDraft(parsed)) {
      clearRiderTripDraft();
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

/** Remove the trip draft after successful wizard submission or explicit discard. */
export function clearRiderTripDraft(): void {
  if (!isBrowser()) return;
  try {
    sessionStorage.removeItem(RIDER_TRIP_DRAFT_KEY);
  } catch {
    // ignore
  }
}

/** Normalize passenger count from the public form (e.g. "5+") for the wizard select. */
export function normalizePassengerCount(passengers: string): string {
  if (passengers === '5+') return '5';
  const n = parseInt(passengers, 10);
  if (Number.isNaN(n) || n < 1) return '1';
  if (n > 8) return '8';
  return String(n);
}

/** Map a Get a Ride draft into Trip Request Wizard form fields. */
export function draftToWizardFields(draft: RiderTripDraft): RiderWizardDraftFields {
  const notes = [draft.notes?.trim(), draft.phone?.trim() ? `Phone: ${draft.phone.trim()}` : '']
    .filter(Boolean)
    .join('\n');

  return {
    pickupLocation: draft.pickup.trim(),
    dropoffLocation: draft.dropoff.trim(),
    pickupDate: draft.date,
    pickupTime: draft.time,
    passengers: normalizePassengerCount(draft.passengers),
    specialInstructions: notes,
  };
}

/** Contact hints for pre-filling the signup form. */
export function draftToSignupHints(draft: RiderTripDraft): { fullName?: string; email?: string } {
  return {
    fullName: draft.name?.trim() || undefined,
    email: draft.email?.trim() || undefined,
  };
}