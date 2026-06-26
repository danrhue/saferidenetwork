-- =============================================================================
-- Missouri — State Certified Mechanic Vehicle Inspection Form
-- Run in Supabase SQL editor
--
-- Copy lives in lib/driver/document-catalog.ts (missouri_vehicle_inspection).
-- This migration adds the requirement for Missouri drivers only.
-- =============================================================================

INSERT INTO public.state_document_requirements (
  state_code,
  document_type,
  sort_order,
  is_required
)
VALUES (
  'MO',
  'missouri_vehicle_inspection',
  45,
  true
)
ON CONFLICT (state_code, document_type) DO UPDATE SET
  sort_order = EXCLUDED.sort_order,
  is_required = EXCLUDED.is_required;