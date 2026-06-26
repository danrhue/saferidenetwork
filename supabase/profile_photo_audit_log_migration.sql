-- Profile photo audit log + optional profile review metadata
-- Run in Supabase SQL Editor after profile_photo_approval_migration.sql

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

COMMENT ON TABLE public.profile_photo_audit_log IS 'Admin approve/reject history for driver profile photos';
COMMENT ON COLUMN public.profile_photo_audit_log.action IS 'approved | rejected';
COMMENT ON COLUMN public.profile_photo_audit_log.rejection_reason IS 'Required context when action = rejected';

-- Quick reference to last review (denormalized; source of truth remains audit log)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS profile_photo_last_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS profile_photo_last_reviewed_by uuid REFERENCES public.profiles(id);

COMMENT ON COLUMN public.profiles.profile_photo_last_reviewed_at IS 'Timestamp of most recent admin profile photo review';
COMMENT ON COLUMN public.profiles.profile_photo_last_reviewed_by IS 'Admin who performed the most recent profile photo review';

ALTER TABLE public.profile_photo_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read profile photo audit log" ON public.profile_photo_audit_log;
CREATE POLICY "Admins can read profile photo audit log"
  ON public.profile_photo_audit_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles admin_p
      WHERE admin_p.id = auth.uid() AND admin_p.is_admin = true
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
      WHERE admin_p.id = auth.uid() AND admin_p.is_admin = true
    )
  );