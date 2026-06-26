import { hasProfilePhotoForOnboarding } from '@/lib/profile-photo';
import type { WizardProfileInput } from '@/lib/driver/wizard-step-validation';
import {
  isValidSsn,
  normalizeSsn,
  validateDateOfBirth,
} from '@/lib/driver/wizard-step-validation';
import { WIZARD_STEP_COUNT, clampWizardStep } from '@/lib/driver/wizard-steps';
import { normalizeStateCodes } from '@/lib/driver/us-states';

export type WizardCompletionContext = {
  documentsUploaded: number;
  documentsRequired: number;
};

function hasValue(profile: WizardProfileInput, field: string): boolean {
  const value = profile[field];
  if (value == null || value === '') return false;
  if (typeof value === 'string') return value.trim().length > 0;
  return true;
}

function mailingAddressComplete(profile: WizardProfileInput): boolean {
  if (profile.mailing_same_as_physical !== false) return true;
  return (
    hasValue(profile, 'mailing_address_line1') &&
    hasValue(profile, 'mailing_city') &&
    hasValue(profile, 'mailing_state') &&
    hasValue(profile, 'mailing_postal_code')
  );
}

/** Step 5 complete when DOB, valid saved SSN, and all personal detail fields are filled. */
export function isPersonalDetailsStepComplete(profile: WizardProfileInput): boolean {
  if (validateDateOfBirth(profile.dob_month, profile.dob_day, profile.dob_year)) {
    return false;
  }

  if (!isValidSsn(normalizeSsn(profile.ssn))) {
    return false;
  }

  const requiredFields = [
    'hair_color',
    'eye_color',
    'height_feet',
    'height_inches',
    'weight_lbs',
    'gender',
  ] as const;

  for (const field of requiredFields) {
    if (!hasValue(profile, field)) return false;
  }

  const weight = Number(profile.weight_lbs);
  return Number.isFinite(weight) && weight >= 50 && weight <= 500;
}

export function isWizardStepComplete(
  step: number,
  profile: WizardProfileInput,
  ctx: WizardCompletionContext
): boolean {
  switch (step) {
    case 1:
      return (
        hasValue(profile, 'first_name') &&
        hasValue(profile, 'last_name') &&
        hasValue(profile, 'email') &&
        hasValue(profile, 'phone') &&
        hasValue(profile, 'phone_type')
      );
    case 2:
      return normalizeStateCodes(profile.driving_states as string[] | undefined).length > 0;
    case 3:
      return (
        hasValue(profile, 'physical_address_line1') &&
        hasValue(profile, 'physical_city') &&
        hasValue(profile, 'physical_state') &&
        hasValue(profile, 'physical_postal_code') &&
        mailingAddressComplete(profile)
      );
    case 4: {
      if (
        !hasValue(profile, 'drivers_license_number') ||
        !hasValue(profile, 'drivers_license_state') ||
        !hasValue(profile, 'drivers_license_exp_month') ||
        !hasValue(profile, 'drivers_license_exp_day') ||
        !hasValue(profile, 'drivers_license_exp_year')
      ) {
        return false;
      }
      const month = Number(profile.drivers_license_exp_month);
      const day = Number(profile.drivers_license_exp_day);
      const year = Number(profile.drivers_license_exp_year);
      const expiration = new Date(year, month - 1, day);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return expiration > today;
    }
    case 5:
      return isPersonalDetailsStepComplete(profile);
    case 6:
      return (
        hasValue(profile, 'emergency_contact_first_name') &&
        hasValue(profile, 'emergency_contact_last_name') &&
        hasValue(profile, 'emergency_contact_phone') &&
        hasValue(profile, 'emergency_contact_phone_type') &&
        hasValue(profile, 'emergency_contact_relation')
      );
    case 7:
      return hasProfilePhotoForOnboarding(profile);
    case 8:
      return !!(
        profile.vehicle_year &&
        profile.vehicle_make &&
        profile.vehicle_model &&
        profile.passenger_capacity
      );
    case 9:
      return !!(
        profile.stripe_account_id &&
        profile.stripe_onboarding_complete &&
        profile.stripe_payouts_enabled
      );
    case 10:
      return (
        ctx.documentsRequired > 0 && ctx.documentsUploaded >= ctx.documentsRequired
      );
    default:
      return false;
  }
}

/** Per-step completion flags for steps 1–10 (index 0 = step 1). */
export function getWizardStepCompletionMap(
  profile: WizardProfileInput,
  ctx: WizardCompletionContext
): boolean[] {
  return Array.from({ length: WIZARD_STEP_COUNT }, (_, index) =>
    isWizardStepComplete(index + 1, profile, ctx)
  );
}

/** Earliest incomplete step, searching from step 1. */
export function getFirstIncompleteWizardStep(
  profile: WizardProfileInput,
  ctx: WizardCompletionContext
): number {
  return getNextIncompleteWizardStep(profile, ctx, 1) ?? WIZARD_STEP_COUNT;
}

/** Next incomplete step at or after `fromStep`; null if every step from there is complete. */
export function getNextIncompleteWizardStep(
  profile: WizardProfileInput,
  ctx: WizardCompletionContext,
  fromStep = 1
): number | null {
  const start = clampWizardStep(fromStep);
  for (let step = start; step <= WIZARD_STEP_COUNT; step += 1) {
    if (!isWizardStepComplete(step, profile, ctx)) {
      return step;
    }
  }
  return null;
}

/** True when steps 1 … throughStep are all complete. */
export function areWizardStepsCompleteThrough(
  throughStep: number,
  profile: WizardProfileInput,
  ctx: WizardCompletionContext
): boolean {
  if (throughStep < 1) return true;
  for (let step = 1; step <= throughStep; step += 1) {
    if (!isWizardStepComplete(step, profile, ctx)) {
      return false;
    }
  }
  return true;
}

/**
 * Smart wizard resume (no URL param):
 * 1. If any step before the saved position is incomplete, go to the earliest incomplete step.
 * 2. If the saved step is incomplete, resume there.
 * 3. If the saved step is complete, jump to the next incomplete step after it.
 * 4. If everything is complete, fall back to onboarding_wizard_step.
 *
 * URL ?step= always wins for explicit deep links.
 */
export function resolveWizardResumeStep(
  urlStepParam: string | null,
  dbStep: number | null | undefined,
  profile: WizardProfileInput,
  ctx: WizardCompletionContext
): number {
  if (urlStepParam) {
    const parsed = parseInt(urlStepParam, 10);
    if (Number.isFinite(parsed) && parsed >= 1) {
      return clampWizardStep(parsed);
    }
  }

  const savedStep = clampWizardStep(dbStep ?? 1);

  if (!areWizardStepsCompleteThrough(savedStep - 1, profile, ctx)) {
    return getFirstIncompleteWizardStep(profile, ctx);
  }

  if (!isWizardStepComplete(savedStep, profile, ctx)) {
    return savedStep;
  }

  const nextIncomplete = getNextIncompleteWizardStep(profile, ctx, savedStep + 1);
  if (nextIncomplete != null) {
    return nextIncomplete;
  }

  return savedStep;
}