import type { SupabaseClient } from '@supabase/supabase-js';
import {
  getIncompleteOfferRequirements,
  type IncompleteOfferRequirement,
} from '@/lib/driver/incomplete-requirements';
import {
  buildDocumentCompletionContext,
  getDriverCompletionPercent,
  getIncompleteWizardSteps,
  isDriverProfileComplete,
  type IncompleteWizardStep,
} from '@/lib/driver/profile-completion';
import type { RequiredDocument } from '@/lib/driver/required-documents';
import {
  resolveRequiredDocumentsForStates,
  type StateRequirementRow,
} from '@/lib/driver/resolve-driver-documents';
import { normalizeStateCodes } from '@/lib/driver/us-states';
import type { PersonalProfile } from '@/lib/driver/onboarding-completion';
import type { WizardCompletionContext } from '@/lib/driver/wizard-steps';

export const PROFILE_INCOMPLETE_OFFER_MESSAGE =
  'Complete your full driver profile (100%) before submitting trip offers.';

export type DriverOfferProfileGate = {
  isComplete: boolean;
  profileCompletion: number;
  incompleteSteps: IncompleteWizardStep[];
  incompleteRequirements: IncompleteOfferRequirement[];
  message: string;
};

export function evaluateDriverOfferProfileGate(
  profile: PersonalProfile,
  docCtx: WizardCompletionContext,
  options?: {
    requiredDocuments?: RequiredDocument[];
    driverDocuments?: { document_type: string; status?: string }[];
  }
): DriverOfferProfileGate {
  const profileCompletion = getDriverCompletionPercent(profile, docCtx);
  const incompleteSteps = getIncompleteWizardSteps(profile, docCtx);
  const incompleteRequirements = getIncompleteOfferRequirements(profile, docCtx, options);
  const isComplete = isDriverProfileComplete(profile, docCtx);

  return {
    isComplete,
    profileCompletion,
    incompleteSteps,
    incompleteRequirements,
    message: isComplete
      ? ''
      : PROFILE_INCOMPLETE_OFFER_MESSAGE,
  };
}

/** Server-side: load profile + documents and evaluate the 100% completion gate. */
export async function loadDriverOfferProfileGate(
  admin: SupabaseClient,
  userId: string
): Promise<DriverOfferProfileGate & { profile: PersonalProfile }> {
  const { data: profileRow, error: profileError } = await admin
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (profileError || !profileRow) {
    throw new Error('Profile not found.');
  }

  const profile: PersonalProfile = {
    ...profileRow,
    mailing_same_as_physical: profileRow.mailing_same_as_physical !== false,
  };

  const { data: docs } = await admin
    .from('driver_documents')
    .select('document_type, status')
    .eq('driver_id', userId);

  const drivingStates = normalizeStateCodes(profileRow.driving_states as string[] | undefined);
  let required: RequiredDocument[] = [];

  if (drivingStates.length > 0) {
    const { data: rows } = await admin
      .from('state_document_requirements')
      .select('state_code, document_type, sort_order, is_required')
      .in('state_code', drivingStates)
      .eq('is_required', true)
      .order('sort_order', { ascending: true });

    required = resolveRequiredDocumentsForStates(
      drivingStates,
      (rows ?? []) as StateRequirementRow[]
    );
  }

  const docCtx = buildDocumentCompletionContext(docs ?? [], required);
  const gate = evaluateDriverOfferProfileGate(profile, docCtx, {
    requiredDocuments: required,
    driverDocuments: docs ?? [],
  });

  return { ...gate, profile };
}

export function profileGateErrorResponse(gate: DriverOfferProfileGate) {
  return {
    error: gate.message,
    profileCompletion: gate.profileCompletion,
    incompleteSteps: gate.incompleteSteps,
    incompleteRequirements: gate.incompleteRequirements,
    code: 'profile_incomplete' as const,
  };
}