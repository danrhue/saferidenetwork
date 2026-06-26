-- =============================================================================
-- Kansas — Vehicle Accident Prevention Course (K.A.R. 91-38-6)
-- Run in Supabase SQL editor
--
-- NOTE: Description copy now lives in lib/driver/document-state-overrides.ts.
-- This migration only ensures KS requires accident_prevention_course.
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
  'School transportation providers must complete a KSDE-approved vehicle accident prevention (defensive driving) course.

K.A.R. 91-38-6

Requirements:
• Complete within 30 days of your first day transporting students
• Renew your certification every 3 years
• Only KSDE-approved courses are accepted

Cost: You are responsible for the course fee (typically $20–$30).

Accepted KSDE-approved providers:
• AARP Driver Safety Program — https://www.aarpdriversafety.org/ ($27 members / $30 non-members)
• AAA RoadWise Driver — https://www.aaadriverprogram.com/kansas/ (usually $20–$30)
• National Safety Council (NSC) — https://www.nsc.org/safety-training/defensive-driving ($24.95–$30)
• Smith System — https://www.smith-system.com/ (primarily fleet programs)
• 3-D Hartford — limited individual options (primarily fleet)

Source: Kansas Activity/School Bus Transportation Mandates, School Bus Safety Unit, KSDE

Upload your certificate of completion when finished.'
)
ON CONFLICT (state_code, document_type) DO UPDATE SET
  is_required = EXCLUDED.is_required,
  sort_order = EXCLUDED.sort_order,
  description = EXCLUDED.description;