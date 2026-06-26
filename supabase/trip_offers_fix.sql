-- Run this in the Supabase SQL Editor to fix trip_offers in production.
-- Safe to re-run (uses IF NOT EXISTS / DROP POLICY IF EXISTS).

ALTER TABLE public.trip_offers
  ADD COLUMN IF NOT EXISTS offered_price numeric;

-- One offer per driver per trip
DO $$
BEGIN
  ALTER TABLE public.trip_offers
    ADD CONSTRAINT trip_offers_trip_driver_unique UNIQUE (trip_id, driver_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- INSERT: drivers may offer on open, paid trips only
DROP POLICY IF EXISTS "Drivers can insert offers on open trips" ON public.trip_offers;
DROP POLICY IF EXISTS "Drivers can insert offers on open paid trips" ON public.trip_offers;

CREATE POLICY "Drivers can insert offers on open paid trips"
  ON public.trip_offers FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = driver_id
    AND EXISTS (
      SELECT 1 FROM public.trips
      WHERE id = trip_id
        AND status = 'open'
        AND payment_status = 'paid'
    )
  );

-- SELECT: drivers see their own offers
DROP POLICY IF EXISTS "Drivers can view their own offers" ON public.trip_offers;
CREATE POLICY "Drivers can view their own offers"
  ON public.trip_offers FOR SELECT
  TO authenticated
  USING (auth.uid() = driver_id);

-- SELECT: organizations see offers on trips they own
DROP POLICY IF EXISTS "Organizations can view offers on their trips" ON public.trip_offers;
CREATE POLICY "Organizations can view offers on their trips"
  ON public.trip_offers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.trips
      WHERE id = trip_id AND organization_id = auth.uid()
    )
  );

-- DELETE: drivers withdraw pending offers
DROP POLICY IF EXISTS "Drivers can delete their own pending offers" ON public.trip_offers;
CREATE POLICY "Drivers can delete their own pending offers"
  ON public.trip_offers FOR DELETE
  TO authenticated
  USING (auth.uid() = driver_id AND status = 'pending');

-- UPDATE: organizations approve/reject offers on their trips
DROP POLICY IF EXISTS "Organizations can update offer status on their trips" ON public.trip_offers;
CREATE POLICY "Organizations can update offer status on their trips"
  ON public.trip_offers FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.trips
      WHERE id = trip_id AND organization_id = auth.uid()
    )
  );