-- Rider profile fields for launch polish
-- Apply in Supabase SQL Editor

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS rider_accessibility_notes text;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url text;

-- Keep avatar_url in sync with legacy storage path when unset
UPDATE public.profiles
SET avatar_url = profile_photo_url
WHERE avatar_url IS NULL AND profile_photo_url IS NOT NULL;

COMMENT ON COLUMN public.profiles.rider_accessibility_notes IS
  'Default accessibility needs for rider accounts; pre-fills trip requests.';