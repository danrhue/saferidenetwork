import type { SupabaseClient } from '@supabase/supabase-js';
import { maskTripLocation } from '@/lib/driver/address-masking';
import {
  buildDocumentCompletionContext,
  getDriverCompletionPercent,
} from '@/lib/driver/profile-completion';
import {
  resolveRequiredDocumentsForStates,
  type StateRequirementRow,
} from '@/lib/driver/resolve-driver-documents';
import type { RequiredDocument } from '@/lib/driver/required-documents';
import { normalizeStateCodes } from '@/lib/driver/us-states';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export type BrowseTrip = {
  id: string;
  title: string;
  description: string | null;
  pickup_area: string;
  dropoff_area: string;
  pickup_time: string;
  price: number | null;
  final_price: number | null;
  distance_miles: number | null;
  status: string;
  payment_status: string;
  organization_id: string | null;
  trip_source?: string | null;
  organization_name?: string;
  organization_photo_url?: string | null;
  passengers?: number | null;
};

export type OpenTripsAccessResult =
  | {
      blocked: true;
      profileCompletion: number;
      message: string;
    }
  | {
      blocked: false;
      trips: BrowseTrip[];
    };

export async function getDriverProfileCompletionPercent(
  supabase: SupabaseClient,
  userId: string,
  email?: string | null
): Promise<number> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  const profileData = profile
    ? {
        ...profile,
        email: profile.email || email || '',
        mailing_same_as_physical: profile.mailing_same_as_physical !== false,
      }
    : { email: email || '', mailing_same_as_physical: true };

  let docs: { document_type: string; status: string }[] = [];
  let required: RequiredDocument[] = [];

  const { data: driverDocs } = await supabase
    .from('driver_documents')
    .select('document_type, status')
    .eq('driver_id', userId);
  docs = driverDocs ?? [];

  const drivingStates = normalizeStateCodes(profileData.driving_states);
  if (drivingStates.length > 0) {
    const admin = getSupabaseAdmin();
    const { data: rows } = await admin
      .from('state_document_requirements')
      .select('state_code, document_type, sort_order, is_required')
      .in('state_code', drivingStates)
      .eq('is_required', true)
      .order('sort_order', { ascending: true });

    required = resolveRequiredDocumentsForStates(
      drivingStates,
      (rows ?? []) as StateRequirementRow[]
    );
  }

  const ctx = buildDocumentCompletionContext(docs, required);
  return getDriverCompletionPercent(profileData, ctx);
}

export async function fetchBrowseTripsForDriver(
  supabase: SupabaseClient,
  userId: string,
  email?: string | null
): Promise<OpenTripsAccessResult> {
  const profileCompletion = await getDriverProfileCompletionPercent(supabase, userId, email);

  if (profileCompletion !== 100) {
    return {
      blocked: true,
      profileCompletion,
      message:
        'Complete your profile and compliance requirements before browsing available trips.',
    };
  }

  const { data: tripsData, error: tripsError } = await supabase
    .from('trips')
    .select(
      'id, title, description, pickup_location, dropoff_location, pickup_time, price, final_price, distance_miles, status, payment_status, organization_id, trip_source, passengers'
    )
    .eq('status', 'open')
    .eq('payment_status', 'paid')
    .order('pickup_time', { ascending: true });

  if (tripsError) {
    throw new Error(`Could not load trips: ${tripsError.message}`);
  }

  const rows = tripsData ?? [];
  const orgIds = [...new Set(rows.map((trip) => trip.organization_id).filter(Boolean))] as string[];
  const profileMap: Record<
    string,
    { organization_name?: string; full_name?: string; profile_photo_url?: string | null }
  > = {};

  if (orgIds.length > 0) {
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, organization_name, full_name, profile_photo_url')
      .in('id', orgIds);

    (profilesData ?? []).forEach((profile) => {
      profileMap[profile.id] = profile;
    });
  }

  const trips: BrowseTrip[] = rows.map((trip) => {
    const isRiderTrip = trip.trip_source === 'rider' || !trip.organization_id;
    const profile = trip.organization_id ? profileMap[trip.organization_id] : null;

    return {
      id: trip.id,
      title: trip.title,
      description: trip.description,
      pickup_area: maskTripLocation(trip.pickup_location),
      dropoff_area: maskTripLocation(trip.dropoff_location),
      pickup_time: trip.pickup_time,
      price: trip.price,
      final_price: trip.final_price,
      distance_miles: trip.distance_miles,
      status: trip.status,
      payment_status: trip.payment_status,
      organization_id: trip.organization_id,
      trip_source: trip.trip_source,
      passengers: trip.passengers,
      organization_name: isRiderTrip
        ? 'Personal Ride'
        : profile?.organization_name || profile?.full_name || 'Organization',
      organization_photo_url: isRiderTrip ? null : profile?.profile_photo_url || null,
    };
  });

  return { blocked: false, trips };
}