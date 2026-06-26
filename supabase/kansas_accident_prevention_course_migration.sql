-- =============================================================================
-- Kansas — Vehicle Accident Prevention Course (K.A.R. 91-38-6)
-- Run in Supabase SQL editor
-- =============================================================================

ALTER TABLE public.state_document_requirements
  ADD COLUMN IF NOT EXISTS description text;

INSERT INTO public.state_document_requirements (
  state_code,
  document_type,
  sort_order,
  is_required,
  description
)
VALUES (
  'KS',
  'accident_prevention_course',
  100,
  true,
  'Each school transportation provider shall successfully complete a vehicle accident prevention course approved by the State Department of Education within 30 days after the first day the driver transports students and shall maintain certification by completion of an accident prevention course at least every three years.

K.A.R. 91-38-6

Source: Kansas Activity/School Bus Transportation Mandates, School Bus Safety Unit, KSDE

The following courses are accepted for the Accident Prevention Course (Defensive Driving) requirement:
• 3-D Hartford
• AARP Driver Safety Program
• American Auto Association (AAA)
• National Safety Council
• Smith System'
)
ON CONFLICT (state_code, document_type) DO UPDATE SET
  is_required = EXCLUDED.is_required,
  sort_order = EXCLUDED.sort_order,
  description = EXCLUDED.description;