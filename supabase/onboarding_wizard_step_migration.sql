-- Persist driver onboarding wizard progress (last visited step)
-- Run in Supabase SQL Editor. No new tables required.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_wizard_step integer;

DO $$
BEGIN
  ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_onboarding_wizard_step_check
    CHECK (
      onboarding_wizard_step IS NULL
      OR (onboarding_wizard_step >= 1 AND onboarding_wizard_step <= 10)
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN public.profiles.onboarding_wizard_step IS 'Last completed or visited step in the 10-step driver profile wizard (1-10)';