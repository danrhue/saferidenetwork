import type { WizardCompletionContext } from '@/lib/driver/wizard-steps';
import { getDriverCompletionPercent } from '@/lib/driver/profile-completion';

export type PersonalProfile = Record<string, unknown>;

/** @deprecated Prefer getDriverCompletionPercent — kept for existing imports. */
export function calculateDriverCompletion(
  profile: PersonalProfile,
  options: WizardCompletionContext
): number {
  return getDriverCompletionPercent(profile, options);
}