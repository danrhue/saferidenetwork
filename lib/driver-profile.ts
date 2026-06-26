import { SupabaseClient } from '@supabase/supabase-js';

export type DriverProfileRow = {
  id: string;
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  role?: string | null;
  phone?: string | null;
  phone_type?: string | null;
  created_at?: string;
  updated_at?: string;
  vehicle_make?: string | null;
  vehicle_model?: string | null;
  vehicle_year?: number | null;
  passenger_capacity?: number | null;
  seating_override_note?: string | null;
  seating_approval_status?: string | null;
  physical_address_line1?: string | null;
  physical_address_line2?: string | null;
  physical_city?: string | null;
  physical_state?: string | null;
  physical_postal_code?: string | null;
  mailing_same_as_physical?: boolean | null;
  mailing_address_line1?: string | null;
  mailing_address_line2?: string | null;
  mailing_city?: string | null;
  mailing_state?: string | null;
  mailing_postal_code?: string | null;
  drivers_license_number?: string | null;
  drivers_license_state?: string | null;
  drivers_license_exp_month?: number | null;
  drivers_license_exp_day?: number | null;
  drivers_license_exp_year?: number | null;
  dob_month?: number | null;
  dob_day?: number | null;
  dob_year?: number | null;
  ssn?: string | null;
  hair_color?: string | null;
  eye_color?: string | null;
  height_feet?: number | null;
  height_inches?: number | null;
  weight_lbs?: number | null;
  gender?: string | null;
  emergency_contact_first_name?: string | null;
  emergency_contact_last_name?: string | null;
  emergency_contact_phone?: string | null;
  emergency_contact_phone_type?: string | null;
  emergency_contact_relation?: string | null;
  organization_name?: string | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
  pendingDocuments?: number;
  [key: string]: unknown;
};

export type AdminTripRow = {
  id: string;
  title: string;
  status: string;
  pickup_location: string;
  dropoff_location: string;
  pickup_address?: string | null;
  dropoff_address?: string | null;
  pickup_time?: string | null;
  organization_id?: string | null;
  rider_id?: string | null;
  assigned_driver_id?: string | null;
  driver_id?: string | null;
  organization_name?: string | null;
  driver_name?: string | null;
  rider_name?: string | null;
  created_at?: string | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
};

export type AdminOrganizationRow = {
  id: string;
  full_name?: string | null;
  organization_name?: string | null;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
  created_at?: string | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
};

export type DeletedProfileRow = {
  id: string;
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  profile_email?: string | null;
  auth_email?: string | null;
  role?: string | null;
  organization_name?: string | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
  deleted_by_email?: string | null;
  created_at?: string | null;
};

export async function enrichDriverProfiles(
  admin: SupabaseClient,
  drivers: DriverProfileRow[]
): Promise<DriverProfileRow[]> {
  return Promise.all(
    drivers.map(async (driver) => {
      const needsAuthLookup =
        !driver.full_name?.trim() ||
        !driver.email?.trim() ||
        (!driver.first_name?.trim() && !driver.last_name?.trim());

      if (!needsAuthLookup) {
        return driver;
      }

      const { data, error } = await admin.auth.admin.getUserById(driver.id);
      if (error || !data.user) {
        return driver;
      }

      const metadataName =
        typeof data.user.user_metadata?.full_name === 'string'
          ? data.user.user_metadata.full_name.trim()
          : '';

      const fallbackName = data.user.email?.split('@')[0] ?? null;
      const authEmail = data.user.email ?? null;

      let firstName = driver.first_name?.trim() || null;
      let lastName = driver.last_name?.trim() || null;
      if (!firstName && !lastName && metadataName) {
        const parts = metadataName.split(/\s+/);
        firstName = parts[0] ?? null;
        lastName = parts.slice(1).join(' ') || null;
      }

      return {
        ...driver,
        email: driver.email?.trim() || authEmail,
        first_name: firstName,
        last_name: lastName,
        full_name:
          driver.full_name?.trim() ||
          metadataName ||
          [firstName, lastName].filter(Boolean).join(' ') ||
          fallbackName,
      };
    })
  );
}

/** Resolve auth.users email for soft-deleted profiles (service role). */
export async function enrichDeletedProfiles(
  admin: SupabaseClient,
  profiles: DeletedProfileRow[]
): Promise<DeletedProfileRow[]> {
  const deletedByIds = Array.from(
    new Set(profiles.map((p) => p.deleted_by).filter(Boolean) as string[])
  );

  const deletedByEmailMap: Record<string, string> = {};
  await Promise.all(
    deletedByIds.map(async (userId) => {
      const { data } = await admin.auth.admin.getUserById(userId);
      if (data.user?.email) {
        deletedByEmailMap[userId] = data.user.email;
      }
    })
  );

  return Promise.all(
    profiles.map(async (profile) => {
      let authEmail: string | null = null;

      const { data, error } = await admin.auth.admin.getUserById(profile.id);
      if (!error && data.user?.email) {
        authEmail = data.user.email;
      }

      return {
        ...profile,
        email: profile.email?.trim() || authEmail,
        auth_email: authEmail,
        deleted_by_email: profile.deleted_by
          ? deletedByEmailMap[profile.deleted_by] ?? null
          : null,
      };
    })
  );
}