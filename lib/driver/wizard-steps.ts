/** Driver profile onboarding wizard — 10 steps. */

export const WIZARD_STEP_COUNT = 10;

export const WIZARD_STEPS = [
  { id: 1, title: 'Personal Info' },
  { id: 2, title: 'Operating States' },
  { id: 3, title: 'Addresses' },
  { id: 4, title: "Driver's License" },
  { id: 5, title: 'Personal Details' },
  { id: 6, title: 'Emergency Contact' },
  { id: 7, title: 'Profile Photo' },
  { id: 8, title: 'Vehicle & Seating' },
  { id: 9, title: 'Payment Setup' },
  { id: 10, title: 'Documents' },
] as const;

export type WizardStepId = (typeof WIZARD_STEPS)[number]['id'];

/** Fields validated (and saved via personal profile) per step. */
export const WIZARD_STEP_FIELDS: Record<number, string[]> = {
  1: ['first_name', 'last_name', 'email', 'phone'],
  3: ['physical_address_line1', 'physical_city', 'physical_state', 'physical_postal_code'],
  4: ['drivers_license_number', 'drivers_license_state'],
  5: ['dob_month', 'dob_day', 'dob_year', 'ssn'],
  6: ['emergency_contact_first_name', 'emergency_contact_last_name', 'emergency_contact_phone'],
};

export const WIZARD_MAILING_FIELDS = [
  'mailing_address_line1',
  'mailing_city',
  'mailing_state',
  'mailing_postal_code',
] as const;

/** Steps that persist personal profile fields when leaving via navigation. */
export const WIZARD_PERSONAL_SAVE_STEPS = new Set([1, 3, 4, 5, 6, 7]);

export function clampWizardStep(step: number): number {
  return Math.min(Math.max(Math.trunc(step) || 1, 1), WIZARD_STEP_COUNT);
}

export function stepRequiresDataSave(step: number): boolean {
  return WIZARD_PERSONAL_SAVE_STEPS.has(step) || step === 2 || step === 8;
}

/** Steps that only persist the wizard step index (no field payload). */
export function stepPersistsProgressOnly(step: number): boolean {
  return step === 9 || step === 10;
}