-- Rider Portal notifications (Phase 1)
-- Run in Supabase SQL Editor after rider_portal_phase1.sql

-- In-app + email notification log
CREATE TABLE IF NOT EXISTS public.rider_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  trip_id uuid REFERENCES public.trips ON DELETE SET NULL,
  type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  action_url text,
  metadata jsonb DEFAULT '{}'::jsonb,
  read_at timestamptz,
  email_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rider_notifications_rider_unread
  ON public.rider_notifications (rider_id, created_at DESC)
  WHERE read_at IS NULL;

ALTER TABLE public.rider_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Riders can view own notifications" ON public.rider_notifications;
CREATE POLICY "Riders can view own notifications"
  ON public.rider_notifications FOR SELECT TO authenticated
  USING (auth.uid() = rider_id);

DROP POLICY IF EXISTS "Riders can update own notifications" ON public.rider_notifications;
CREATE POLICY "Riders can update own notifications"
  ON public.rider_notifications FOR UPDATE TO authenticated
  USING (auth.uid() = rider_id)
  WITH CHECK (auth.uid() = rider_id);

-- Per-rider channel preferences
CREATE TABLE IF NOT EXISTS public.rider_notification_preferences (
  rider_id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email_enabled boolean NOT NULL DEFAULT true,
  in_app_enabled boolean NOT NULL DEFAULT true,
  -- TODO: sms_enabled, push_enabled
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rider_notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Riders can view own notification preferences" ON public.rider_notification_preferences;
CREATE POLICY "Riders can view own notification preferences"
  ON public.rider_notification_preferences FOR SELECT TO authenticated
  USING (auth.uid() = rider_id);

DROP POLICY IF EXISTS "Riders can upsert own notification preferences" ON public.rider_notification_preferences;
CREATE POLICY "Riders can upsert own notification preferences"
  ON public.rider_notification_preferences FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = rider_id);

DROP POLICY IF EXISTS "Riders can update own notification preferences" ON public.rider_notification_preferences;
CREATE POLICY "Riders can update own notification preferences"
  ON public.rider_notification_preferences FOR UPDATE TO authenticated
  USING (auth.uid() = rider_id)
  WITH CHECK (auth.uid() = rider_id);