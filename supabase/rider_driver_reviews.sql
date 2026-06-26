-- Rider Portal: extend driver_reviews for rider-authored reviews
-- Apply in Supabase SQL editor after rider portal migrations.
--
-- Existing org reviews use organization_id; rider reviews use rider_id.
-- The review body is stored in the `review` column (exposed as `comment` in the app).

-- ---------------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------------

ALTER TABLE public.driver_reviews
  ADD COLUMN IF NOT EXISTS rider_id uuid REFERENCES auth.users;

ALTER TABLE public.driver_reviews
  ALTER COLUMN organization_id DROP NOT NULL;

ALTER TABLE public.driver_reviews
  DROP CONSTRAINT IF EXISTS driver_reviews_reviewer_check;

ALTER TABLE public.driver_reviews
  ADD CONSTRAINT driver_reviews_reviewer_check
  CHECK (
    (organization_id IS NOT NULL AND rider_id IS NULL)
    OR (rider_id IS NOT NULL AND organization_id IS NULL)
  );

-- One review per trip (already enforced; keep idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS driver_reviews_trip_id_key
  ON public.driver_reviews (trip_id);

-- ---------------------------------------------------------------------------
-- RLS — riders
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Riders can insert reviews for their completed trips"
  ON public.driver_reviews;

CREATE POLICY "Riders can insert reviews for their completed trips"
  ON public.driver_reviews
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = rider_id
    AND rider_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.trips
      WHERE id = trip_id
        AND rider_id = auth.uid()
        AND status = 'completed'
        AND assigned_driver_id = driver_id
        AND trip_source = 'rider'
    )
  );

DROP POLICY IF EXISTS "Riders can view their own reviews"
  ON public.driver_reviews;

CREATE POLICY "Riders can view their own reviews"
  ON public.driver_reviews
  FOR SELECT
  TO authenticated
  USING (auth.uid() = rider_id);

-- ---------------------------------------------------------------------------
-- Optional aggregation view (driver profile / public rating later)
-- TODO: Expose avg_rating via materialized view or profiles cache for performance
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.driver_rating_stats AS
SELECT
  driver_id,
  COUNT(*)::integer AS review_count,
  ROUND(AVG(rating)::numeric, 1) AS avg_rating
FROM public.driver_reviews
GROUP BY driver_id;

GRANT SELECT ON public.driver_rating_stats TO authenticated;