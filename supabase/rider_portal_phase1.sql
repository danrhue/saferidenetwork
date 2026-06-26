-- Rider Portal Phase 1 — trips columns + rider RLS
-- Apply in Supabase SQL Editor before rider_auto_match.sql and other rider_*.sql files.

-- Rider-sourced trips have no organization owner
ALTER TABLE public.trips ALTER COLUMN organization_id DROP NOT NULL;

ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS rider_id uuid REFERENCES auth.users;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS trip_source text DEFAULT 'organization';
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS matching_mode text DEFAULT 'manual_review';
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS policy_acknowledged_at timestamptz;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS assignment_expires_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_trips_rider_id ON public.trips (rider_id);
CREATE INDEX IF NOT EXISTS idx_trips_trip_source ON public.trips (trip_source);

-- PostgREST embed: profiles!trips_assigned_driver_id_fkey on trip detail queries
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'trips_assigned_driver_profiles_fkey'
  ) THEN
    ALTER TABLE public.trips
      ADD CONSTRAINT trips_assigned_driver_profiles_fkey
      FOREIGN KEY (assigned_driver_id) REFERENCES public.profiles(id);
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN foreign_key_violation THEN NULL;
END $$;

-- Riders can read their own trips (required for My Trips + trip detail pages)
DROP POLICY IF EXISTS "Riders can view own trips" ON public.trips;
CREATE POLICY "Riders can view own trips"
  ON public.trips FOR SELECT
  TO authenticated
  USING (auth.uid() = rider_id);

-- Riders can cancel open/assigned trips from the portal
DROP POLICY IF EXISTS "Riders can update own trips" ON public.trips;
CREATE POLICY "Riders can update own trips"
  ON public.trips FOR UPDATE
  TO authenticated
  USING (auth.uid() = rider_id)
  WITH CHECK (auth.uid() = rider_id);

-- Riders can view offers on their trips (pending driver preview)
DROP POLICY IF EXISTS "Riders can view offers on their trips" ON public.trip_offers;
CREATE POLICY "Riders can view offers on their trips"
  ON public.trip_offers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.trips t
      WHERE t.id = trip_offers.trip_id
        AND t.rider_id = auth.uid()
    )
  );