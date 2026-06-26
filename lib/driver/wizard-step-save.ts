import type { SupabaseClient } from '@supabase/supabase-js';
import { clampWizardStep } from '@/lib/driver/wizard-steps';

export type WizardStepSaveResult =
  | { ok: true }
  | { ok: false; error: string };

export async function persistOnboardingWizardStep(
  supabase: SupabaseClient,
  userId: string,
  step: number
): Promise<WizardStepSaveResult> {
  const safeStep = clampWizardStep(step);

  const { error } = await supabase
    .from('profiles')
    .update({
      onboarding_wizard_step: safeStep,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}