-- Rider Portal auto-match buffer functions (v1.1)
-- Apply after rider_portal_phase1.sql if not already present in Supabase.

CREATE OR REPLACE FUNCTION public.start_rider_auto_match(
  p_trip_id uuid,
  p_offer_id uuid,
  p_buffer_seconds integer DEFAULT 60
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trip public.trips%ROWTYPE;
BEGIN
  SELECT * INTO v_trip FROM public.trips WHERE id = p_trip_id FOR UPDATE;

  IF v_trip.trip_source <> 'rider' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_rider_trip');
  END IF;

  IF v_trip.matching_mode <> 'auto_first_offer' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'manual_mode');
  END IF;

  IF v_trip.status <> 'open' OR v_trip.assigned_driver_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_open');
  END IF;

  UPDATE public.trip_offers
  SET status = 'pending_confirmation'
  WHERE id = p_offer_id AND status = 'pending';

  UPDATE public.trips
  SET status = 'pending_assignment',
      assignment_expires_at = now() + (p_buffer_seconds || ' seconds')::interval,
      updated_at = now()
  WHERE id = p_trip_id;

  RETURN jsonb_build_object(
    'ok', true,
    'expires_at', now() + (p_buffer_seconds || ' seconds')::interval
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_expired_rider_assignments()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  r record;
BEGIN
  FOR r IN
    SELECT t.id AS trip_id, o.id AS offer_id, o.driver_id
    FROM public.trips t
    JOIN public.trip_offers o ON o.trip_id = t.id AND o.status = 'pending_confirmation'
    WHERE t.status = 'pending_assignment'
      AND t.assignment_expires_at IS NOT NULL
      AND t.assignment_expires_at <= now()
    FOR UPDATE OF t SKIP LOCKED
  LOOP
    UPDATE public.trip_offers
    SET status = 'approved', confirmed_at = now()
    WHERE id = r.offer_id;

    UPDATE public.trip_offers
    SET status = 'rejected'
    WHERE trip_id = r.trip_id AND id <> r.offer_id AND status IN ('pending', 'pending_confirmation');

    UPDATE public.trips
    SET status = 'assigned',
        assigned_driver_id = r.driver_id,
        assignment_expires_at = NULL,
        updated_at = now()
    WHERE id = r.trip_id;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;