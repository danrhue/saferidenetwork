-- Align trip_locations with latitude/longitude + speed/accuracy metadata.
-- Safe to run multiple times.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trip_locations'
      AND column_name = 'lat'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trip_locations'
      AND column_name = 'latitude'
  ) THEN
    ALTER TABLE public.trip_locations RENAME COLUMN lat TO latitude;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trip_locations'
      AND column_name = 'lng'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trip_locations'
      AND column_name = 'longitude'
  ) THEN
    ALTER TABLE public.trip_locations RENAME COLUMN lng TO longitude;
  END IF;
END $$;

ALTER TABLE public.trip_locations
  ADD COLUMN IF NOT EXISTS latitude numeric,
  ADD COLUMN IF NOT EXISTS longitude numeric,
  ADD COLUMN IF NOT EXISTS speed numeric,
  ADD COLUMN IF NOT EXISTS accuracy numeric;

-- Backfill if both legacy and new columns exist side by side
UPDATE public.trip_locations
SET latitude = lat
WHERE latitude IS NULL AND lat IS NOT NULL;

UPDATE public.trip_locations
SET longitude = lng
WHERE longitude IS NULL AND lng IS NOT NULL;