-- Rider Portal SMS notifications (Phase 1)
-- Apply after rider_notifications.sql

-- ---------------------------------------------------------------------------
-- Preferences: SMS channel toggle (opt-in — default off for cost/compliance)
-- ---------------------------------------------------------------------------

ALTER TABLE public.rider_notification_preferences
  ADD COLUMN IF NOT EXISTS sms_enabled boolean NOT NULL DEFAULT false;

-- ---------------------------------------------------------------------------
-- In-app notification log: track when SMS was sent
-- ---------------------------------------------------------------------------

ALTER TABLE public.rider_notifications
  ADD COLUMN IF NOT EXISTS sms_sent_at timestamptz;

-- ---------------------------------------------------------------------------
-- SMS delivery log — deduplication + audit (service role writes only)
-- One SMS per trip per notification type (buffer_started, assignment_confirmed, etc.)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.rider_sms_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  trip_id uuid REFERENCES public.trips ON DELETE SET NULL,
  notification_type text NOT NULL,
  phone_last4 text,
  provider text,
  provider_message_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rider_sms_log_trip_type_unique UNIQUE (trip_id, notification_type)
);

CREATE INDEX IF NOT EXISTS idx_rider_sms_log_rider_created
  ON public.rider_sms_log (rider_id, created_at DESC);

ALTER TABLE public.rider_sms_log ENABLE ROW LEVEL SECURITY;

-- No client policies — inserts/reads via service role (getSupabaseAdmin) only.