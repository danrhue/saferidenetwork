-- =============================================================================
-- SafeRide Network — State-based driver document requirements
-- Run in Supabase SQL editor after schema.sql
-- =============================================================================

-- 1. Driver operating states on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS driving_states text[] NOT NULL DEFAULT '{}'::text[];

COMMENT ON COLUMN public.profiles.driving_states IS
  'US state codes where the driver plans to operate (e.g. KS, MO). Drives required document set.';

-- Backfill existing drivers with Kansas as a sensible default
UPDATE public.profiles
SET driving_states = ARRAY['KS']::text[]
WHERE role = 'driver'
  AND (driving_states IS NULL OR driving_states = '{}'::text[]);

-- 2. State → document requirement mapping
CREATE TABLE IF NOT EXISTS public.state_document_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state_code text NOT NULL,
  document_type text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_required boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (state_code, document_type)
);

CREATE INDEX IF NOT EXISTS state_document_requirements_state_idx
  ON public.state_document_requirements (state_code, sort_order);

ALTER TABLE public.state_document_requirements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read state document requirements"
  ON public.state_document_requirements;
CREATE POLICY "Authenticated users can read state document requirements"
  ON public.state_document_requirements
  FOR SELECT
  TO authenticated
  USING (true);

-- 3. Rename legacy Kansas-specific document types to generic identifiers
UPDATE public.driver_documents
SET document_type = 'dot_physical'
WHERE document_type = 'kansas_dot_physical';

UPDATE public.driver_documents
SET document_type = 'accident_prevention_course'
WHERE document_type = 'kansas_accident_prevention';

-- 4. Seed default requirement set (former Kansas list) for every US state + DC
--    Document names/descriptions are generic in the application catalog.
INSERT INTO public.state_document_requirements (state_code, document_type, sort_order, is_required)
SELECT s.state_code, d.document_type, d.sort_order, true
FROM (
  VALUES
    ('AL'), ('AK'), ('AZ'), ('AR'), ('CA'), ('CO'), ('CT'), ('DE'), ('DC'), ('FL'),
    ('GA'), ('HI'), ('ID'), ('IL'), ('IN'), ('IA'), ('KS'), ('KY'), ('LA'), ('ME'),
    ('MD'), ('MA'), ('MI'), ('MN'), ('MS'), ('MO'), ('MT'), ('NE'), ('NV'), ('NH'),
    ('NJ'), ('NM'), ('NY'), ('NC'), ('ND'), ('OH'), ('OK'), ('OR'), ('PA'), ('RI'),
    ('SC'), ('SD'), ('TN'), ('TX'), ('UT'), ('VT'), ('VA'), ('WA'), ('WV'), ('WI'), ('WY')
) AS s(state_code)
CROSS JOIN (
  VALUES
    ('drivers_license', 10),
    ('proof_of_insurance', 20),
    ('vehicle_registration', 30),
    ('vehicle_inspection', 40),
    ('english_language_proficiency', 50),
    ('background_check_fingerprinting', 60),
    ('drug_test', 70),
    ('saferide_course', 80),
    ('dot_physical', 90),
    ('accident_prevention_course', 100),
    ('tb_test', 110),
    ('cpr_training', 120),
    ('first_aid_training', 130),
    ('defensive_driving', 140),
    ('safety_meetings', 150)
) AS d(document_type, sort_order)
ON CONFLICT (state_code, document_type) DO NOTHING;