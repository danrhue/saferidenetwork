import type { SupabaseClient } from '@supabase/supabase-js';
import { maskTripLocation } from '@/lib/driver/address-masking';
import { getTripPayoutAmount } from '@/lib/driver/driver-earnings';

const ASSIGNED_TRIP_SELECT =
  'id, title, pickup_location, dropoff_location, pickup_time, status, final_price, total_price, price, driver_payout_status, organization_id';

type AssignedTripRow = {
  id: string;
  title: string;
  pickup_location: string;
  dropoff_location: string;
  pickup_time: string;
  status: string;
  final_price: number | null;
  total_price: number | null;
  price: number | null;
  driver_payout_status: string | null;
  organization_id: string | null;
};

export type AdminDriverAssignedTrip = {
  id: string;
  title: string;
  status: string;
  pickup_time: string;
  pickup_location: string;
  dropoff_location: string;
  pickup_area: string;
  dropoff_area: string;
  payout_amount: number;
  driver_payout_status: string | null;
  organization_name: string;
};

export function formatAdminTripPayout(amount: number): string {
  return amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  });
}

async function loadOrganizationNames(
  admin: SupabaseClient,
  orgIds: string[]
): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  if (orgIds.length === 0) return map;

  const { data, error } = await admin
    .from('profiles')
    .select('id, organization_name, full_name')
    .in('id', orgIds);

  if (error) {
    console.error('Assigned trips org lookup error:', error);
    return map;
  }

  (data ?? []).forEach((profile) => {
    map[profile.id] = profile.organization_name || profile.full_name || 'Organization';
  });

  return map;
}

export async function fetchAssignedTripsForDriver(
  admin: SupabaseClient,
  driverId: string
): Promise<AdminDriverAssignedTrip[]> {
  const { data, error } = await admin
    .from('trips')
    .select(ASSIGNED_TRIP_SELECT)
    .eq('assigned_driver_id', driverId)
    .is('deleted_at', null)
    .order('pickup_time', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as AssignedTripRow[];
  const orgIds = [
    ...new Set(rows.map((row) => row.organization_id).filter(Boolean) as string[]),
  ];
  const orgNames = await loadOrganizationNames(admin, orgIds);

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    status: row.status,
    pickup_time: row.pickup_time,
    pickup_location: row.pickup_location,
    dropoff_location: row.dropoff_location,
    pickup_area: maskTripLocation(row.pickup_location),
    dropoff_area: maskTripLocation(row.dropoff_location),
    payout_amount: getTripPayoutAmount(row),
    driver_payout_status: row.driver_payout_status,
    organization_name: row.organization_id
      ? orgNames[row.organization_id] ?? 'Organization'
      : '—',
  }));
}