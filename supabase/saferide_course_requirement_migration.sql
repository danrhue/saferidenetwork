-- =============================================================================
-- SafeRide Network — SafeRide Course requirement (all US states + DC)
-- Run in Supabase SQL editor
-- =============================================================================

ALTER TABLE public.state_document_requirements
  ADD COLUMN IF NOT EXISTS description text;

COMMENT ON COLUMN public.state_document_requirements.description IS
  'Optional per-state instructions shown in the driver My Documents UI.';

INSERT INTO public.state_document_requirements (
  state_code,
  document_type,
  sort_order,
  is_required,
  description
)
SELECT
  s.state_code,
  'saferide_course',
  80,
  true,
  'You must complete the SafeRide training course before driving.
Cost: $25 (paid by you)

How to complete:
Go to https://everdriven.talentlms.com/
Click Signup in the upper right.
Create your account and log in.
Click Get your first course.
Select the course that matches your language and vehicle type.

Note: The wheelchair accessible vehicle course also covers non-wheelchair vehicles (it just has one extra module).'
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
  sort_order = EXCLUDED.sort_order,
  description = EXCLUDED.description;