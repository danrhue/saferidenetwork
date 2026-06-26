-- =============================================================================
-- SafeRide Network — Soft Delete Migration
-- =============================================================================
-- Run in Supabase SQL Editor (production + staging).
--
-- NOTE: This project uses a unified `profiles` table for drivers, organizations,
-- and riders (via `role`). There is no separate `drivers` or `organizations`
-- table. Trips live in `trips` (not `rides`).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Columns
-- -----------------------------------------------------------------------------

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users;

ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users;

CREATE INDEX IF NOT EXISTS profiles_deleted_at_idx
  ON public.profiles (deleted_at)
  WHERE deleted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS trips_deleted_at_idx
  ON public.trips (deleted_at)
  WHERE deleted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS profiles_role_active_idx
  ON public.profiles (role)
  WHERE deleted_at IS NULL;

-- -----------------------------------------------------------------------------
-- 2. Audit log
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.soft_delete_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('profile', 'trip')),
  entity_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('soft_delete', 'restore')),
  performed_by uuid REFERENCES auth.users,
  performed_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS soft_delete_audit_entity_idx
  ON public.soft_delete_audit_log (entity_type, entity_id, performed_at DESC);

ALTER TABLE public.soft_delete_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read soft delete audit log" ON public.soft_delete_audit_log;
CREATE POLICY "Admins can read soft delete audit log"
  ON public.soft_delete_audit_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_admin = true AND p.deleted_at IS NULL
    )
  );

-- Inserts performed via service role in admin API routes.

-- -----------------------------------------------------------------------------
-- 3. Helper — active profile check (for RLS / joins)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_active_profile(profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = profile_id AND deleted_at IS NULL
  );
$$;

-- -----------------------------------------------------------------------------
-- 4. RLS — hide soft-deleted profiles & trips by default
-- -----------------------------------------------------------------------------

-- Profiles: marketplace reads exclude deleted accounts
DROP POLICY IF EXISTS "Authenticated users can read profiles for marketplace" ON public.profiles;
CREATE POLICY "Authenticated users can read profiles for marketplace"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL);

-- Users can still read their own profile row (login/layout checks handle deactivation)
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Trips: organization policies
DROP POLICY IF EXISTS "Organizations can view their own trips" ON public.trips;
CREATE POLICY "Organizations can view their own trips"
  ON public.trips
  FOR SELECT
  TO authenticated
  USING (auth.uid() = organization_id AND deleted_at IS NULL);

DROP POLICY IF EXISTS "Organizations can update their own trips" ON public.trips;
CREATE POLICY "Organizations can update their own trips"
  ON public.trips
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = organization_id AND deleted_at IS NULL)
  WITH CHECK (auth.uid() = organization_id AND deleted_at IS NULL);

DROP POLICY IF EXISTS "Organizations can insert their own trips" ON public.trips;
CREATE POLICY "Organizations can insert their own trips"
  ON public.trips
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = organization_id
    AND public.is_active_profile(auth.uid())
  );

-- Trips: driver marketplace / assigned
DROP POLICY IF EXISTS "Drivers can view open or assigned trips" ON public.trips;
CREATE POLICY "Drivers can view open or assigned trips"
  ON public.trips
  FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      (status = 'open' AND payment_status = 'paid')
      OR assigned_driver_id = auth.uid()
    )
  );

-- Trips: rider portal (from rider_portal_phase1.sql)
DROP POLICY IF EXISTS "Riders can view own trips" ON public.trips;
CREATE POLICY "Riders can view own trips"
  ON public.trips
  FOR SELECT
  TO authenticated
  USING (auth.uid() = rider_id AND deleted_at IS NULL);

DROP POLICY IF EXISTS "Riders can update own trips" ON public.trips;
CREATE POLICY "Riders can update own trips"
  ON public.trips
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = rider_id AND deleted_at IS NULL)
  WITH CHECK (auth.uid() = rider_id AND deleted_at IS NULL);

-- Driver execution updates
DROP POLICY IF EXISTS "Drivers can update their assigned trips for execution" ON public.trips;
CREATE POLICY "Drivers can update their assigned trips for execution"
  ON public.trips
  FOR UPDATE
  TO authenticated
  USING (assigned_driver_id = auth.uid() AND deleted_at IS NULL)
  WITH CHECK (assigned_driver_id = auth.uid() AND deleted_at IS NULL);

-- Trip offers: only on active, non-deleted trips
DROP POLICY IF EXISTS "Drivers can insert offers on open paid trips" ON public.trip_offers;
CREATE POLICY "Drivers can insert offers on open paid trips"
  ON public.trip_offers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = driver_id
    AND public.is_active_profile(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.trips
      WHERE id = trip_id
        AND deleted_at IS NULL
        AND status = 'open'
        AND payment_status = 'paid'
    )
  );

DROP POLICY IF EXISTS "Organizations can view offers on their trips" ON public.trip_offers;
CREATE POLICY "Organizations can view offers on their trips"
  ON public.trip_offers
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.trips
      WHERE id = trip_id
        AND organization_id = auth.uid()
        AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "Organizations can update offer status on their trips" ON public.trip_offers;
CREATE POLICY "Organizations can update offer status on their trips"
  ON public.trip_offers
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.trips
      WHERE id = trip_id
        AND organization_id = auth.uid()
        AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "Riders can view offers on their trips" ON public.trip_offers;
CREATE POLICY "Riders can view offers on their trips"
  ON public.trip_offers
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.trips
      WHERE id = trip_id
        AND rider_id = auth.uid()
        AND deleted_at IS NULL
    )
  );

-- -----------------------------------------------------------------------------
-- 5. Admin soft-delete / restore RPCs (service role or admin API may call directly)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.log_soft_delete_action(
  p_entity_type text,
  p_entity_id uuid,
  p_action text,
  p_performed_by uuid,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.soft_delete_audit_log (
    entity_type, entity_id, action, performed_by, metadata
  ) VALUES (
    p_entity_type, p_entity_id, p_action, p_performed_by, p_metadata
  );
END;
$$;