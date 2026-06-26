-- 1. Create profiles table
create table public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  full_name text,
  phone text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. Create documents table
create table public.documents (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  document_type text not null,           -- e.g. 'drivers_license_front', 'proof_of_insurance', etc.
  file_path text not null,
  status text default 'pending',         -- pending, approved, rejected
  uploaded_at timestamptz default now(),
  reviewed_at timestamptz,
  notes text
);

-- Enable Row Level Security
alter table public.profiles enable row level security;
alter table public.documents enable row level security;

-- Allow users to view and update their own profile
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Allow users to insert their own profile (recommended for the apply form's upsert on first signup)
create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Allow users to insert their own documents
create policy "Users can insert their own documents"
  on public.documents for insert
  with check (auth.uid() = user_id);

-- Allow users to view their own documents
create policy "Users can view own documents"
  on public.documents for select
  using (auth.uid() = user_id);

-- ============================================
-- STORAGE BUCKET POLICIES (run after creating bucket 'documents')
-- ============================================

-- IMPORTANT: First create a private bucket named 'driver-documents' in Supabase Storage.

-- Allow authenticated users to upload their own files (path must start with their user id)
create policy "Users can upload own documents"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'driver-documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow authenticated users to view their own files
create policy "Users can view own documents"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'driver-documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Optional: allow users to update/delete their own files if needed
-- create policy "Users can update own documents"
--   on storage.objects for update to authenticated
--   using (bucket_id = 'driver-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

-- create policy "Users can delete own documents"
--   on storage.objects for delete to authenticated
--   using (bucket_id = 'driver-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================
-- COMPANY UPDATES + VIEW TRACKING (for NEW badges)
-- ============================================

-- Company updates table (announcements posted by admin)
create table if not exists public.company_updates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.company_updates enable row level security;

-- All authenticated users (drivers) can read every update
create policy "Authenticated users can read all company updates"
  on public.company_updates
  for select
  to authenticated
  using (true);

-- Allow inserts/updates/deletes for now (admin UI performs its own email check).
-- You can later restrict this to service role only or add a security definer function.
create policy "Allow inserts for company updates (via admin UI)"
  on public.company_updates
  for insert
  to authenticated
  with check (true);

create policy "Allow updates for company updates (via admin UI)"
  on public.company_updates
  for update
  to authenticated
  using (true);

create policy "Allow deletes for company updates (via admin UI)"
  on public.company_updates
  for delete
  to authenticated
  using (true);

-- Tracks which updates each driver has seen.
-- Used so the "NEW" badge disappears after a driver views the page.
-- Table name matches the driver updates page: user_update_views
create table if not exists public.user_update_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  update_id uuid not null references public.company_updates(id) on delete cascade,
  viewed_at timestamptz default now() not null,
  unique (user_id, update_id)
);

alter table public.user_update_views enable row level security;

-- Drivers can only see and record their own view history
create policy "Users can view their own update view records"
  on public.user_update_views
  for select
  using (auth.uid() = user_id);

create policy "Users can mark updates as viewed"
  on public.user_update_views
  for insert
  with check (auth.uid() = user_id);

-- ============================================
-- TRIP MARKETPLACE TABLES
-- ============================================

-- Add role and organization_name to profiles (if not exists)
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS role text DEFAULT 'driver',
  ADD COLUMN IF NOT EXISTS organization_name text;

-- Add photo columns for driver profile and vehicle photos (POC feature)
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS profile_photo_url text,
  ADD COLUMN IF NOT EXISTS vehicle_photos jsonb DEFAULT '[]'::jsonb;

-- Stripe Connect (Express accounts for drivers)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_account_id text,
  ADD COLUMN IF NOT EXISTS stripe_onboarding_complete boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_charges_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_payouts_enabled boolean DEFAULT false;

-- Driver vehicle seating capacity
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS vehicle_year integer,
  ADD COLUMN IF NOT EXISTS vehicle_make text,
  ADD COLUMN IF NOT EXISTS vehicle_model text,
  ADD COLUMN IF NOT EXISTS passenger_capacity integer,
  ADD COLUMN IF NOT EXISTS seating_override_note text,
  ADD COLUMN IF NOT EXISTS seating_approval_status text DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS seating_approved_at timestamptz;

-- Admins can update seating approval on driver profiles
DROP POLICY IF EXISTS "Admins can update driver seating approvals" ON public.profiles;
create policy "Admins can update driver seating approvals"
  on public.profiles for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles admin_p
      where admin_p.id = auth.uid() and admin_p.is_admin = true
    )
  )
  with check (
    exists (
      select 1 from public.profiles admin_p
      where admin_p.id = auth.uid() and admin_p.is_admin = true
    )
  );

-- Note: profile_photo_url is also used for organization logos (orgs upload their logo here)

-- Profiles RLS for profile_photo_url (org logos) and marketplace:
-- Organizations can update their own profile (including profile_photo_url)
-- Drivers can view profile_photo_url (and basic info) of organizations whose trips/offers they can access
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

-- Allow authenticated marketplace participants to read profiles (org logos visible to drivers on trips they can see; driver info visible to orgs)
create policy "Authenticated users can read profiles for marketplace"
  on public.profiles for select
  to authenticated
  using (true);

-- Trips table: posted by organizations
create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references auth.users not null,
  title text not null,
  description text,
  pickup_location text not null,
  dropoff_location text not null,
  pickup_time timestamptz not null,
  price numeric,  -- legacy / driver compensation
  status text default 'open',  -- open, assigned, in_progress, completed, cancelled
  assigned_driver_id uuid references auth.users,
  payment_status text default 'unpaid',  -- unpaid, paid (for driver compensation)
  platform_fee_status text default 'unpaid',  -- unpaid, paid
  stripe_driver_payment_id text,
  stripe_platform_payment_id text,
  stripe_checkout_session_id text,
  stripe_transfer_id text,
  driver_payout_status text DEFAULT 'pending', -- pending, transferred, failed, not_applicable
  distance_miles numeric,
  base_price numeric,
  peak_multiplier numeric default 1,
  calculated_price numeric,
  final_price numeric,  -- driver compensation final
  platform_fee numeric,
  total_price numeric,  -- final_price + platform_fee
  start_lat numeric,
  start_lng numeric,
  end_lat numeric,
  end_lng numeric,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.trips enable row level security;

-- Organizations can manage their own trips
create policy "Organizations can insert their own trips"
  on public.trips for insert
  to authenticated
  with check (auth.uid() = organization_id);

create policy "Organizations can view their own trips"
  on public.trips for select
  to authenticated
  using (auth.uid() = organization_id);

DROP POLICY IF EXISTS "Organizations can update their own trips" ON public.trips;
create policy "Organizations can update their own trips"
  on public.trips for update
  to authenticated
  using (auth.uid() = organization_id)
  with check (auth.uid() = organization_id);

-- Drivers can view open PAID trips in the marketplace, plus any trip assigned to them
DROP POLICY IF EXISTS "Drivers can view open or assigned trips" ON public.trips;
create policy "Drivers can view open or assigned trips"
  on public.trips for select
  to authenticated
  using (
    (status = 'open' AND payment_status = 'paid')
    OR assigned_driver_id = auth.uid()
  );

-- Trip offers table
create table if not exists public.trip_offers (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references public.trips not null,
  driver_id uuid references auth.users not null,
  message text,
  offered_price numeric,  -- driver's quoted rate (defaults to trip rate at submission)
  status text default 'pending',  -- pending, approved, rejected
  created_at timestamptz default now() not null,
  unique (trip_id, driver_id)  -- one offer per driver per trip
);

alter table public.trip_offers enable row level security;

-- Drivers can create offers on open PAID trips and view their own offers
DROP POLICY IF EXISTS "Drivers can insert offers on open trips" ON public.trip_offers;
DROP POLICY IF EXISTS "Drivers can insert offers on open paid trips" ON public.trip_offers;
create policy "Drivers can insert offers on open paid trips"
  on public.trip_offers for insert
  to authenticated
  with check (
    auth.uid() = driver_id AND
    EXISTS (
      SELECT 1 FROM public.trips
      WHERE id = trip_id
        AND status = 'open'
        AND payment_status = 'paid'
    )
  );

DROP POLICY IF EXISTS "Drivers can view their own offers" ON public.trip_offers;
create policy "Drivers can view their own offers"
  on public.trip_offers for select
  to authenticated
  using (auth.uid() = driver_id);

-- Drivers can delete their own pending offers (to withdraw)
DROP POLICY IF EXISTS "Drivers can delete their own pending offers" ON public.trip_offers;
create policy "Drivers can delete their own pending offers"
  on public.trip_offers for delete
  to authenticated
  using (auth.uid() = driver_id AND status = 'pending');

-- Organizations can view offers on their trips and update status
DROP POLICY IF EXISTS "Organizations can view offers on their trips" ON public.trip_offers;
create policy "Organizations can view offers on their trips"
  on public.trip_offers for select
  to authenticated
  using (
    EXISTS (
      SELECT 1 FROM public.trips
      WHERE id = trip_id AND organization_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Organizations can update offer status on their trips" ON public.trip_offers;
create policy "Organizations can update offer status on their trips"
  on public.trip_offers for update
  to authenticated
  using (
    EXISTS (
      SELECT 1 FROM public.trips
      WHERE id = trip_id AND organization_id = auth.uid()
    )
  );

-- Note: App logic will handle only one approved per trip and reject others.

-- Pricing settings table for admin configuration
create table if not exists public.pricing_settings (
  id uuid primary key default gen_random_uuid(),
  base_rate_per_mile numeric default 2.5,
  platform_fee_percent numeric default 0.15,
  peak_rules jsonb default '[{"startHour":6.5,"endHour":9,"days":[1,2,3,4,5],"multiplier":1.35},{"startHour":13.5,"endHour":16,"days":[1,2,3,4,5],"multiplier":1.35}]'::jsonb,
  updated_at timestamptz default now() not null
);

-- Insert default row if not exists
insert into public.pricing_settings (id) 
select gen_random_uuid() 
where not exists (select 1 from public.pricing_settings);

alter table public.pricing_settings enable row level security;

-- All authenticated users can read pricing settings (needed for organizations to calculate trip prices)
create policy "Authenticated can read pricing settings"
  on public.pricing_settings for select
  to authenticated
  using (true);

-- Only admins can update pricing settings (enforced via is_admin flag on profiles)
create policy "Admins can update pricing settings"
  on public.pricing_settings for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );

-- Allow admins to insert if needed (for initial setup)
create policy "Admins can insert pricing settings"
  on public.pricing_settings for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );

-- ============================================
-- DRIVER REVIEWS (for trust and ratings)
-- ============================================

create table if not exists public.driver_reviews (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references public.trips not null,
  organization_id uuid references auth.users not null,
  driver_id uuid references auth.users not null,
  rating smallint not null check (rating >= 1 and rating <= 5),
  review text,
  created_at timestamptz default now() not null,
  unique (trip_id)  -- only one review per trip
);

alter table public.driver_reviews enable row level security;

-- Organizations can insert/select their own reviews (for trips they posted)
create policy "Organizations can insert reviews for their completed trips"
  on public.driver_reviews for insert
  to authenticated
  with check (
    auth.uid() = organization_id AND
    EXISTS (
      SELECT 1 FROM public.trips 
      WHERE id = trip_id AND organization_id = auth.uid() AND status = 'completed'
    )
  );

create policy "Organizations can view their own reviews"
  on public.driver_reviews for select
  to authenticated
  using (auth.uid() = organization_id);

-- Drivers can view reviews about themselves (for their profile)
create policy "Drivers can view reviews about themselves"
  on public.driver_reviews for select
  to authenticated
  using (auth.uid() = driver_id);

-- Note: To show average rating publicly or to orgs when viewing offers, we can use a view or client-side aggregation.
-- For POC, we'll query reviews for the relevant drivers and compute average in the app.

-- Add payment_status and stripe id if not present (already added in previous migration)
-- ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'unpaid';
-- ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS stripe_payment_id text;

-- ============================================
-- TRIP EXECUTION ENHANCEMENTS (for driver trip screen)
-- ============================================

-- Passengers count for trip details (drivers see on execution screen)
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS passengers integer DEFAULT 1;

-- Allow drivers to update key execution fields (status, times, location) on trips assigned to them
-- This is required for the Start Trip / Complete Trip flow with geolocation
DROP POLICY IF EXISTS "Drivers can update their assigned trips for execution" ON public.trips;
create policy "Drivers can update their assigned trips for execution"
  on public.trips for update
  to authenticated
  using (
    assigned_driver_id = auth.uid() 
    AND status IN ('assigned', 'in_progress')
  )
  with check (
    assigned_driver_id = auth.uid()
    AND status IN ('assigned', 'in_progress', 'completed')
  );

-- Note: Organizations retain their update policy for admin actions (cancel, complete from their side, etc.)
-- Drivers can still SELECT their assigned trips (including in_progress/completed) via existing policy.

-- ============================================
-- ADMIN FLAG + SAFETY CHECKLIST + HISTORICAL LOCATIONS
-- ============================================

-- Add is_admin flag to profiles for proper admin protection (replaces hardcoded email)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;

-- Add checklist completion timestamp for driver pre-trip safety checklist
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS checklist_completed_at timestamptz;

-- New table to store historical GPS points for trip trails (admin path visualization)
create table if not exists public.trip_locations (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references public.trips not null,
  latitude numeric not null,
  longitude numeric not null,
  speed numeric,
  accuracy numeric,
  recorded_at timestamptz default now() not null
);

alter table public.trip_locations enable row level security;

-- Drivers can insert their own trip locations (during tracking)
create policy "Drivers can insert locations for their assigned trips"
  on public.trip_locations for insert
  to authenticated
  with check (
    EXISTS (
      SELECT 1 FROM public.trips 
      WHERE id = trip_id AND assigned_driver_id = auth.uid()
    )
  );

-- Drivers, orgs, and admins can view locations for relevant trips (simplified for POC - authenticated can view for monitoring)
create policy "Authenticated users can view trip locations for monitoring"
  on public.trip_locations for select
  to authenticated
  using (true);

-- Example to set first admin (run this after the admin user signs up and profile exists):
-- UPDATE public.profiles SET is_admin = true WHERE id = (SELECT id FROM auth.users WHERE email = 'dan@shininglightcapital.com' LIMIT 1);

-- Real-time GPS tracking columns for live driver location on active trips
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS current_lat numeric;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS current_lng numeric;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS last_location_update timestamptz;

-- The existing "Drivers can update their assigned trips for execution" policy already permits
-- the assigned driver to UPDATE current_lat / current_lng / last_location_update (and other fields)
-- while the trip status is 'assigned' or 'in_progress'. No additional policy is strictly required,
-- but we document it here for clarity and re-assert the policy in case of re-runs.

-- (Optional explicit policy if you prefer field-level granularity in future - the broad row policy covers live tracking updates.)

-- ============================================
-- ADMIN LIVE MONITORING ADVANCEMENTS (clustering + real-time geofencing)
-- ============================================
-- No new persistent tables required for initial geofencing implementation.
-- Geofence events and statuses are derived in the admin client from:
--   • trip_locations (historical GPS points for trail replay)
--   • trips.current_lat / current_lng + realtime updates
--   • Geocoded centers of the trip pickup_location / dropoff_location strings (200m radius)
-- Haversine distance used for enter/exit detection (see lib/geo-utils.ts).
-- Future extension: add trip_geofence_definitions table + trip_geofence_events log table for custom/admin-defined geofences and persistent audit trail.
-- Clustering for Active Trips list view is performed client-side using @googlemaps/markerclusterer on current positions (no server storage change).

-- ============================================
-- DRIVER PHOTOS STORAGE (profile + vehicle photos)
-- ============================================

-- Create a private bucket named 'driver-photos' in Supabase Storage (run manually if not exists).
-- Policies below assume the bucket exists.

-- Drivers can upload their own photos (path starts with their user id)
create policy "Drivers can upload own photos"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'driver-photos' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Drivers can view their own photos
create policy "Drivers can view own photos"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'driver-photos' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Drivers can update/delete their own photos
create policy "Drivers can update own photos"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'driver-photos' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Drivers can delete own photos"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'driver-photos' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Organizations can view photos of drivers who offered on their trips (for viewing offers)
create policy "Orgs can view photos of offering drivers"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'driver-photos' AND
    EXISTS (
      SELECT 1 FROM public.trip_offers o
      JOIN public.trips t ON t.id = o.trip_id
      WHERE t.organization_id = auth.uid()
        AND o.driver_id::text = (storage.foldername(name))[1]
    )
  );

-- ============================================
-- ORGANIZATION LOGOS STORAGE
-- ============================================

-- IMPORTANT: Create private bucket 'organization-logos' in Supabase Storage.

-- Organizations can upload their own logo
create policy "Organizations can upload own logo"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'organization-logos' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Organizations can view/update/delete their own logo
create policy "Organizations can view own logo"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'organization-logos' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Organizations can update own logo"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'organization-logos' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Organizations can delete own logo"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'organization-logos' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Drivers can view organization logos for trips they can see (open trips or their offers)
create policy "Drivers can view org logos for visible trips"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'organization-logos' AND
    EXISTS (
      SELECT 1 FROM public.trips t
      LEFT JOIN public.trip_offers o ON o.trip_id = t.id AND o.driver_id = auth.uid()
      WHERE t.organization_id::text = (storage.foldername(name))[1]
        AND (
          t.status = 'open'
          OR o.driver_id IS NOT NULL
          OR t.assigned_driver_id = auth.uid()
        )
    )
  );

-- Also allow organizations to view photos of their assigned drivers (for active trips)
create policy "Orgs can view photos of assigned drivers"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'driver-photos' AND
    EXISTS (
      SELECT 1 FROM public.trips t
      WHERE t.organization_id = auth.uid()
        AND t.assigned_driver_id::text = (storage.foldername(name))[1]
    )
  );