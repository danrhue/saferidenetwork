-- Profile photo approval workflow for drivers
-- Run in Supabase SQL Editor after profile-photos storage bucket exists.

-- profile_photo_url already exists on profiles (storage path, e.g. {user_id}/profile.jpg)

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

COMMENT ON COLUMN public.profiles.profile_photo_url IS 'Storage path in profile-photos bucket';
COMMENT ON COLUMN public.profiles.profile_photo_status IS 'pending | approved | rejected — admin review for driver headshots';
COMMENT ON COLUMN public.profiles.profile_photo_rejection_reason IS 'Admin-provided reason when profile_photo_status = rejected';

-- Grandfather existing driver photos as approved
UPDATE public.profiles
SET profile_photo_status = 'approved'
WHERE role = 'driver'
  AND profile_photo_url IS NOT NULL
  AND profile_photo_status IS NULL;

-- Admins can update profile photo review fields on driver profiles
DROP POLICY IF EXISTS "Admins can update driver profile photo reviews" ON public.profiles;
CREATE POLICY "Admins can update driver profile photo reviews"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles admin_p
      WHERE admin_p.id = auth.uid() AND admin_p.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles admin_p
      WHERE admin_p.id = auth.uid() AND admin_p.is_admin = true
    )
  );