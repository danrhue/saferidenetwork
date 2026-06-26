-- Optional: reinforce org trip update policy (run if client-side updates were failing via RLS)
DROP POLICY IF EXISTS "Organizations can update their own trips" ON public.trips;
CREATE POLICY "Organizations can update their own trips"
  ON public.trips FOR UPDATE
  TO authenticated
  USING (auth.uid() = organization_id)
  WITH CHECK (auth.uid() = organization_id);