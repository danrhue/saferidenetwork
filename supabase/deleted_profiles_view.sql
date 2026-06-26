-- =============================================================================
-- deleted_profiles_view — soft-deleted profiles with auth.users email
-- Run in Supabase SQL Editor after soft_delete_migration.sql
-- =============================================================================

CREATE OR REPLACE VIEW public.deleted_profiles_view AS
SELECT
  p.id,
  p.full_name,
  p.first_name,
  p.last_name,
  p.role,
  p.organization_name,
  p.created_at,
  p.deleted_at,
  p.deleted_by,
  p.email AS profile_email,
  u.email AS auth_email,
  COALESCE(NULLIF(TRIM(p.email), ''), u.email) AS email,
  admin_u.email AS deleted_by_email
FROM public.profiles p
INNER JOIN auth.users u ON u.id = p.id
LEFT JOIN auth.users admin_u ON admin_u.id = p.deleted_by
WHERE p.deleted_at IS NOT NULL;

COMMENT ON VIEW public.deleted_profiles_view IS
  'Soft-deleted profiles joined to auth.users for admin Deleted Items page.';

-- Admin API uses service role
GRANT SELECT ON public.deleted_profiles_view TO service_role;