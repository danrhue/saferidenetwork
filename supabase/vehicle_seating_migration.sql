-- Vehicle seating capacity for drivers — run in Supabase SQL Editor

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS vehicle_year integer,
  ADD COLUMN IF NOT EXISTS vehicle_make text,
  ADD COLUMN IF NOT EXISTS vehicle_model text,
  ADD COLUMN IF NOT EXISTS passenger_capacity integer,
  ADD COLUMN IF NOT EXISTS seating_override_note text,
  ADD COLUMN IF NOT EXISTS seating_approval_status text DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS seating_approved_at timestamptz;

-- Valid approval statuses
DO $$
BEGIN
  ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_seating_approval_status_check
    CHECK (seating_approval_status IN ('pending', 'approved', 'rejected'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN public.profiles.passenger_capacity IS 'Usable passenger seats (excludes driver)';
COMMENT ON COLUMN public.profiles.seating_approval_status IS 'pending when capacity differs from suggestion; approved/rejected by admin';

-- Admins can update seating approval fields on any driver profile
DROP POLICY IF EXISTS "Admins can update driver seating approvals" ON public.profiles;
CREATE POLICY "Admins can update driver seating approvals"
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

-- Admins can read all profiles (for seating review queue)
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    auth.uid() = id
    OR EXISTS (
      SELECT 1 FROM public.profiles admin_p
      WHERE admin_p.id = auth.uid() AND admin_p.is_admin = true
    )
  );