-- Shrink profile wizard from 10 steps to 9 (Stripe moved to /dashboard/payments).
-- Run in Supabase SQL Editor after deploying the app update.

-- Legacy step 10 (Documents) maps to step 9.
UPDATE public.profiles
SET onboarding_wizard_step = 9
WHERE onboarding_wizard_step = 10;

-- Drivers saved on removed step 9 (Payment Setup) should resume at Documents.
UPDATE public.profiles
SET onboarding_wizard_step = 9
WHERE onboarding_wizard_step = 9
  AND (
    stripe_account_id IS NULL
    OR stripe_onboarding_complete IS NOT TRUE
    OR stripe_payouts_enabled IS NOT TRUE
  );

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_onboarding_wizard_step_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_onboarding_wizard_step_check
  CHECK (
    onboarding_wizard_step IS NULL
    OR (onboarding_wizard_step >= 1 AND onboarding_wizard_step <= 9)
  );

COMMENT ON COLUMN public.profiles.onboarding_wizard_step IS 'Last step the driver was on in the 9-step profile wizard (1-9); used to resume progress';