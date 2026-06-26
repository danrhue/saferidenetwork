-- Public driver rating aggregates for Rider Portal trust display
-- Apply after rider_driver_reviews.sql
--
-- The driver_rating_stats view is filtered by driver_reviews RLS when queried
-- directly. This SECURITY DEFINER RPC returns full aggregates for any driver.

CREATE OR REPLACE FUNCTION public.get_driver_rating_stats(p_driver_id uuid)
RETURNS TABLE (
  driver_id uuid,
  avg_rating numeric,
  review_count integer
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    s.driver_id,
    s.avg_rating,
    s.review_count
  FROM public.driver_rating_stats s
  WHERE s.driver_id = p_driver_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_driver_rating_stats(uuid) TO authenticated;