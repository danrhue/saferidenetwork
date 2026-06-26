-- Profile Photo Review — ensure all schema pieces exist (idempotent)
-- Run in Supabase SQL Editor if /admin/profile-photos fails to load.

-- 1) Core approval columns (from profile_photo_approval_migration.sql)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS profile_photo_status text,
  ADD COLUMN IF NOT EXISTS profile_photo_rejection_reason text;

DO $$
BEGIN
  ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_profile_photo_status_check
    CHECK (
      profile_photo_status IS NULL
      OR profile_photo_status IN ('pending', 'approved', 'rejected')
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2) Optional last-review metadata (from profile_photo_audit_log_migration.sql)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS profile_photo_last_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS profile_photo_last_reviewed_by uuid REFERENCES public.profiles(id);

-- 3) Audit log table
CREATE TABLE IF NOT EXISTS public.profile_photo_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  admin_id uuid NOT NULL REFERENCES public.profiles(id),
  action text NOT NULL CHECK (action IN ('approved', 'rejected')),
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS profile_photo_audit_log_profile_id_idx
  ON public.profile_photo_audit_log (profile_id, created_at DESC);

CREATE INDEX IF NOT EXISTS profile_photo_audit_log_created_at_idx
  ON public.profile_photo_audit_log (created_at DESC);

-- 4) RLS for authenticated admins (service role bypasses RLS; useful for future client-side reads)
ALTER TABLE public.profile_photo_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read profile photo audit log" ON public.profile_photo_audit_log;
CREATE POLICY "Admins can read profile photo audit log"
  ON public.profile_photo_audit_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles admin_p
      WHERE admin_p.id = auth.uid() AND admin_p.is_admin = true AND admin_p.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "Admins can insert profile photo audit log" ON public.profile_photo_audit_log;
CREATE POLICY "Admins can insert profile photo audit log"
  ON public.profile_photo_audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles admin_p
      WHERE admin_p.id = auth.uid() AND admin_p.is_admin = true AND admin_p.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "Admins can update driver profile photo reviews" ON public.profiles;
CREATE POLICY "Admins can update driver profile photo reviews"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles admin_p
      WHERE admin_p.id = auth.uid() AND admin_p.is_admin = true AND admin_p.deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles admin_p
      WHERE admin_p.id = auth.uid() AND admin_p.is_admin = true AND admin_p.deleted_at IS NULL
    )
  );

-- Grandfather existing uploads without a status
UPDATE public.profiles
SET profile_photo_status = 'approved'
WHERE role = 'driver'
  AND profile_photo_url IS NOT NULL
  AND profile_photo_status IS NULL;