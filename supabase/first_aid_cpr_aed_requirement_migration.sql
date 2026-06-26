-- =============================================================================
-- SafeRide Network — First Aid & CPR/AED requirement (all US states + DC)
-- Run in Supabase SQL editor
--
-- Copy lives in lib/driver/document-catalog.ts (first_aid_cpr_aed).
-- sort_order 125 places this after CPR (120) and before First Aid (130).
-- =============================================================================

INSERT INTO public.state_document_requirements (
  state_code,
  document_type,
  sort_order,
  is_required
)
SELECT
  s.state_code,
  'first_aid_cpr_aed',
  125,
  true
FROM (
  VALUES
    ('AL'), ('AK'), ('AZ'), ('AR'), ('CA'), ('CO'), ('CT'), ('DE'), ('DC'), ('FL'),
    ('GA'), ('HI'), ('ID'), ('IL'), ('IN'), ('IA'), ('KS'), ('KY'), ('LA'), ('ME'),
    ('MD'), ('MA'), ('MI'), ('MN'), ('MS'), ('MO'), ('MT'), ('NE'), ('NV'), ('NH'),
    ('NJ'), ('NM'), ('NY'), ('NC'), ('ND'), ('OH'), ('OK'), ('OR'), ('PA'), ('RI'),
    ('SC'), ('SD'), ('TN'), ('TX'), ('UT'), ('VT'), ('VA'), ('WA'), ('WV'), ('WI'), ('WY')
) AS s(state_code)
ON CONFLICT (state_code, document_type) DO UPDATE SET
  is_required = EXCLUDED.is_required,
  sort_order = EXCLUDED.sort_order;