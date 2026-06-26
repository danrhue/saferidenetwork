import {
  countRequiredUploadSlots,
  countUploadedRequiredDocuments,
} from '@/lib/driver/document-completion';
import {
  getWizardStepCompletionMap,
  isWizardStepComplete,
  WIZARD_STEP_COUNT,
  WIZARD_STEPS,
  type WizardCompletionContext,
} from '@/lib/driver/wizard-steps';
import type { PersonalProfile } from '@/lib/driver/onboarding-completion';

export type IncompleteWizardStep = {
  id: number;
  title: string;
};

export type DriverDocumentCompletionInput = {
  document_type: string;
};

export type RequiredDocumentCompletionInput = {
  type: string;
  uploadable?: boolean;
};

/** Build document counts used by wizard step 9 and completion %. */
export function buildDocumentCompletionContext(
  docs: DriverDocumentCompletionInput[],
  required: RequiredDocumentCompletionInput[]
): WizardCompletionContext {
  return {
    documentsUploaded: countUploadedRequiredDocuments(docs, required),
    documentsRequired: countRequiredUploadSlots(required),
  };
}

/**
 * Single source of truth for driver profile completion %.
 * Mirrors the 9-step wizard: each completed step contributes equally.
 */
export function getDriverCompletionPercent(
  profile: PersonalProfile,
  ctx: WizardCompletionContext
): number {
  const steps = getWizardStepCompletionMap(profile, ctx);
  const filled = steps.filter(Boolean).length;
  return Math.round((filled / WIZARD_STEP_COUNT) * 100);
}

/** True when every wizard step (profile + compliance) is complete. */
export function isDriverProfileComplete(
  profile: PersonalProfile,
  ctx: WizardCompletionContext
): boolean {
  return getDriverCompletionPercent(profile, ctx) === 100;
}

/** Wizard steps still needed before the driver can submit trip offers. */
export function getIncompleteWizardSteps(
  profile: PersonalProfile,
  ctx: WizardCompletionContext
): IncompleteWizardStep[] {
  return WIZARD_STEPS.filter(
    (step) => !isWizardStepComplete(step.id, profile, ctx)
  ).map((step) => ({ id: step.id, title: step.title }));
}