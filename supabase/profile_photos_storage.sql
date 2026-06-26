-- Driver profile photos bucket (PUBLIC)
-- Create bucket in Supabase Dashboard → Storage → New bucket: profile-photos (public = true)
-- Bucket name must match PROFILE_PHOTOS_BUCKET in lib/storage/profile-photos.ts

-- Remove legacy private-bucket policies if re-running
DROP POLICY IF EXISTS "Users can read own profile photo" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can read profile photos" ON storage.objects;

-- Anyone can view approved public profile photos
DROP POLICY IF EXISTS "Public can read profile photos" ON storage.objects;
CREATE POLICY "Public can read profile photos"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'profile-photos');

DROP POLICY IF EXISTS "Users can upload own profile photo" ON storage.objects;
CREATE POLICY "Users can upload own profile photo"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'profile-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can update own profile photo" ON storage.objects;
CREATE POLICY "Users can update own profile photo"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'profile-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'profile-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can delete own profile photo" ON storage.objects;
CREATE POLICY "Users can delete own profile photo"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'profile-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );