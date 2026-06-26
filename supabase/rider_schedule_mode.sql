-- Rider schedule preference (ASAP vs scheduled) — optional column for trip detail messaging
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS schedule_mode text DEFAULT 'scheduled';