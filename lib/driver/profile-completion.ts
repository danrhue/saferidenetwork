import {
  getWizardStepCompletionMap,
  WIZARD_STEP_COUNT,
  type WizardCompletionContext,
} from '@/lib/driver/wizard-steps';
import type { PersonalProfile } from '@/lib/driver/onboarding-completion';

export type DriverDocumentCompletionInput = {
  document_type: string;
};

export type RequiredDocumentCompletionInput = {
  uploadable?: boolean;
};

/** Build document counts used by wizard step 9 and completion %. */
export function buildDocumentCompletionContext(
  docs: DriverDocumentCompletionInput[],
  required: RequiredDocumentCompletionInput[]
): WizardCompletionContext {
  const uploadableRequired = required.filter((d) => d.uploadable).length;
  const uploadedTypes = new Set(docs.map((d) => d.document_type)).size;
  return {
    documentsUploaded: uploadedTypes,
    documentsRequired: uploadableRequired,
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