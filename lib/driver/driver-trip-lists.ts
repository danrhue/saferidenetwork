import type { SupabaseClient } from '@supabase/supabase-js';

export const ACTIVE_TRIP_STATUSES = ['assigned', 'in_progress'] as const;

export type DriverTripSummary = {
  id: string;
  title: string;
  pickup_location: string;
  dropoff_location: string;
  pickup_time: string;
  status: string;
  organization_id: string;
  distance_miles: number | null;
  price: number | null;
  final_price: number | null;
  passengers: number | null;
  description?: string | null;
  assigned_driver_id?: string | null;
};

export type DriverOfferRow = {
  id: string;
  status: string;
  message: string | null;
  offered_price: number | null;
  created_at: string;
  trip_id: string;
};

export type DriverOffer = {
  id: string;
  status: string;
  message: string | null;
  offered_price: number | null;
  created_at: string;
  trip: DriverTripSummary & {
    organization_name?: string;
    organization_photo_url?: string | null;
  };
};

export type DriverAssignedTrip = {
  id: string;
  title: string;
  pickup_location: string;
  dropoff_location: string;
  pickup_time: string;
  status: string;
  passengers: number | null;
  description: string | null;
  organization_name?: string;
  organization_photo_url?: string | null;
};

type OrgProfile = {
  organization_name?: string;
  profile_photo_url?: string | null;
};

async function loadOrgProfiles(
  supabase: SupabaseClient,
  orgIds: string[]
): Promise<Record<string, OrgProfile>> {
  const map: Record<string, OrgProfile> = {};
  if (orgIds.length === 0) return map;

  const { data, error } = await supabase
    .from('profiles')
    .select('id, organization_name, full_name, profile_photo_url')
    .in('id', orgIds);

  if (error) {
    console.error('Org profiles fetch error:', error);
    return map;
  }

  (data || []).forEach((p) => {
    map[p.id] = {
      organization_name: p.organization_name || p.full_name || 'Organization',
      profile_photo_url: p.profile_photo_url,
    };
  });

  return map;
}

/** Trips assigned to this driver that are ready or in progress. */
export async function fetchDriverAssignedTrips(
  supabase: SupabaseClient,
  driverId: string
): Promise<DriverAssignedTrip[]> {
  const { data: tripsData, error: tripsError } = await supabase
    .from('trips')
    .select(
      'id, title, pickup_location, dropoff_location, pickup_time, status, passengers, description, organization_id'
    )
    .eq('assigned_driver_id', driverId)
    .in('status', [...ACTIVE_TRIP_STATUSES])
    .order('pickup_time', { ascending: true });

  if (tripsError) {
    throw new Error(`Could not load active trips: ${tripsError.message}`);
  }

  const orgIds = [...new Set((tripsData || []).map((t) => t.organization_id))];
  const profileMap = await loadOrgProfiles(supabase, orgIds);

  return (tripsData || []).map((t) => {
    const profile = profileMap[t.organization_id];
    return {
      id: t.id,
      title: t.title,
      pickup_location: t.pickup_location,
      dropoff_location: t.dropoff_location,
      pickup_time: t.pickup_time,
      status: t.status,
      passengers: t.passengers,
      description: t.description,
      organization_name: profile?.organization_name || 'Organization',
      organization_photo_url: profile?.profile_photo_url || null,
    };
  });
}

/** Submitted offers excluding trips that are now active assignments for this driver. */
export async function fetchDriverPendingOffers(
  supabase: SupabaseClient,
  driverId: string,
  assignedTripIds: Set<string>
): Promise<DriverOffer[]> {
  const { data: offersData, error: offersError } = await supabase
    .from('trip_offers')
    .select('id, status, message, offered_price, created_at, trip_id')
    .eq('driver_id', driverId)
    .order('created_at', { ascending: false });

  if (offersError) {
    throw new Error(`Could not load offers: ${offersError.message}`);
  }

  const offerRows = (offersData || []) as DriverOfferRow[];
  const tripIds = [...new Set(offerRows.map((o) => o.trip_id))];

  const tripMap: Record<string, DriverTripSummary> = {};

  if (tripIds.length > 0) {
    const { data: tripsData, error: tripsError } = await supabase
      .from('trips')
      .select(
        'id, title, pickup_location, dropoff_location, pickup_time, status, organization_id, distance_miles, price, final_price, passengers, assigned_driver_id'
      )
      .in('id', tripIds);

    if (tripsError) {
      throw new Error(`Could not load trip details: ${tripsError.message}`);
    }

    (tripsData || []).forEach((t) => {
      tripMap[t.id] = t as DriverTripSummary;
    });

    const orgIds = [...new Set((tripsData || []).map((t) => t.organization_id))];
    const profileMap = await loadOrgProfiles(supabase, orgIds);

    return offerRows.reduce<DriverOffer[]>((acc, offer) => {
      const trip = tripMap[offer.trip_id];
      if (!trip) return acc;

      if (assignedTripIds.has(trip.id)) {
        return acc;
      }

      const profile = profileMap[trip.organization_id];
      acc.push({
        id: offer.id,
        status: offer.status,
        message: offer.message,
        offered_price: offer.offered_price,
        created_at: offer.created_at,
        trip: {
          ...trip,
          organization_name: profile?.organization_name || 'Organization',
          organization_photo_url: profile?.profile_photo_url || null,
        },
      });
      return acc;
    }, []);
  }

  return [];
}

export function getTripStatusBadgeClass(status: string): string {
  if (status === 'assigned') return 'bg-green-100 text-green-800 border-green-200';
  if (status === 'in_progress') return 'bg-blue-100 text-blue-800 border-blue-200';
  if (status === 'open') return 'bg-emerald-50 text-emerald-800 border-emerald-200';
  if (status === 'completed') return 'bg-purple-50 text-purple-800 border-purple-200';
  return 'bg-gray-100 text-gray-700 border-gray-200';
}