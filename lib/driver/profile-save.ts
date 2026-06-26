import type { SupabaseClient } from '@supabase/supabase-js';

/** Columns on `profiles` that the driver personal-info wizard may update. */
export const DRIVER_PROFILE_PERSONAL_COLUMNS = [
  'first_name',
  'last_name',
  'full_name',
  'phone',
  'phone_type',
  'physical_address_line1',
  'physical_address_line2',
  'physical_city',
  'physical_state',
  'physical_postal_code',
  'mailing_same_as_physical',
  'mailing_address_line1',
  'mailing_address_line2',
  'mailing_city',
  'mailing_state',
  'mailing_postal_code',
  'drivers_license_number',
  'drivers_license_state',
  'drivers_license_exp_month',
  'drivers_license_exp_day',
  'drivers_license_exp_year',
  'dob_month',
  'dob_day',
  'dob_year',
  'ssn',
  'hair_color',
  'eye_color',
  'height_feet',
  'height_inches',
  'weight_lbs',
  'gender',
  'emergency_contact_first_name',
  'emergency_contact_last_name',
  'emergency_contact_phone',
  'emergency_contact_phone_type',
  'emergency_contact_relation',
] as const;

export type DriverProfilePersonalColumn = (typeof DRIVER_PROFILE_PERSONAL_COLUMNS)[number];

export type DriverProfilePersonalInput = Partial<
  Record<DriverProfilePersonalColumn, string | number | boolean | null>
>;

function coerceProfileValue(
  key: DriverProfilePersonalColumn,
  value: unknown
): string | number | boolean | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;

  const integerFields = new Set<DriverProfilePersonalColumn>([
    'drivers_license_exp_month',
    'drivers_license_exp_day',
    'drivers_license_exp_year',
    'dob_month',
    'dob_day',
    'dob_year',
    'height_feet',
    'height_inches',
    'weight_lbs',
  ]);

  if (key === 'mailing_same_as_physical') {
    return value !== false;
  }

  if (integerFields.has(key)) {
    const num = typeof value === 'number' ? value : parseInt(String(value), 10);
    return Number.isFinite(num) ? num : null;
  }

  return typeof value === 'string' ? value.trim() : String(value);
}

/** Build a safe profiles update payload — never includes email or unrelated columns. */
export function buildDriverProfileUpdatePayload(
  profile: Record<string, unknown>
): DriverProfilePersonalInput {
  const payload: DriverProfilePersonalInput = {};

  for (const key of DRIVER_PROFILE_PERSONAL_COLUMNS) {
    if (!(key in profile)) continue;
    const coerced = coerceProfileValue(key, profile[key]);
    if (coerced !== undefined) {
      payload[key] = coerced;
    }
  }

  const firstName = String(payload.first_name ?? profile.first_name ?? '').trim();
  const lastName = String(payload.last_name ?? profile.last_name ?? '').trim();
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
  if (fullName) {
    payload.full_name = fullName;
  }

  return payload;
}

export async function saveDriverPersonalProfile(
  supabase: SupabaseClient,
  userId: string,
  profile: Record<string, unknown>
) {
  const payload = {
    ...buildDriverProfileUpdatePayload(profile),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('profiles')
    .update(payload)
    .eq('id', userId)
    .select('id')
    .maybeSingle();

  if (error) {
    return { error };
  }

  if (!data) {
    const insertPayload = {
      id: userId,
      role: 'driver',
      ...buildDriverProfileUpdatePayload(profile),
      updated_at: new Date().toISOString(),
    };

    const { error: insertError } = await supabase.from('profiles').insert(insertPayload);
    return { error: insertError };
  }

  return { error: null };
}