-- =============================================================================
-- SafeRide Network — Split driver's license into front and back uploads
-- Run in Supabase SQL editor
-- =============================================================================

-- 1. Add front/back requirements everywhere drivers_license was required
INSERT INTO public.state_document_requirements (state_code, document_type, sort_order, is_required)
SELECT state_code, 'drivers_license_front', 10, is_required
FROM public.state_document_requirements
WHERE document_type = 'drivers_license'
ON CONFLICT (state_code, document_type) DO UPDATE SET
  sort_order = EXCLUDED.sort_order,
  is_required = EXCLUDED.is_required;

INSERT INTO public.state_document_requirements (state_code, document_type, sort_order, is_required)
SELECT state_code, 'drivers_license_back', 11, is_required
FROM public.state_document_requirements
WHERE document_type = 'drivers_license'
ON CONFLICT (state_code, document_type) DO UPDATE SET
  sort_order = EXCLUDED.sort_order,
  is_required = EXCLUDED.is_required;

-- 2. Remove the legacy combined requirement
DELETE FROM public.state_document_requirements
WHERE document_type = 'drivers_license';

-- 3. Remove legacy combined uploads — drivers must re-upload front and back separately
DELETE FROM public.driver_documents
WHERE document_type = 'drivers_license';