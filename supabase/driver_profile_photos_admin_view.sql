-- Optional: profiles joined to auth.users for email (reference / reporting only).
-- The admin API loads email via auth.admin.getUserById() — this view is not required.

CREATE OR REPLACE VIEW public.driver_profile_photos_admin_view AS
SELECT
  p.id,
  p.full_name,
  p.phone,
  u.email,
  p.profile_photo_url,
  p.profile_photo_status,
  p.profile_photo_rejection_reason,
  p.updated_at,
  p.deleted_at
FROM public.profiles p
INNER JOIN auth.users u ON u.id = p.id
WHERE p.role = 'driver';

COMMENT ON VIEW public.driver_profile_photos_admin_view IS
  'Driver profile photo review list — email from auth.users, for admin service role API.';

GRANT SELECT ON public.driver_profile_photos_admin_view TO service_role;