import { NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/admin-auth';
import {
  isMissingTripLocationColumnError,
  normalizeTripLocation,
  TRIP_LOCATION_SELECT_LEGACY,
  TRIP_LOCATION_SELECT_MODERN,
} from '@/lib/trip-locations';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ tripId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireAdminUser();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { tripId } = await context.params;

  const { data: trip, error: tripError } = await auth.admin
    .from('trips')
    .select('*')
    .eq('id', tripId)
    .is('deleted_at', null)
    .maybeSingle();

  if (tripError) {
    return NextResponse.json({ error: tripError.message }, { status: 500 });
  }

  if (!trip) {
    return NextResponse.json({ error: 'Trip not found.' }, { status: 404 });
  }

  const profileIds = [trip.organization_id, trip.assigned_driver_id].filter(Boolean) as string[];

  let organizationName = 'Unknown Organization';
  let driverName = 'Unknown Driver';

  if (profileIds.length > 0) {
    const { data: profiles } = await auth.admin
      .from('profiles')
      .select('id, full_name, organization_name')
      .in('id', profileIds);

    const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));

    const orgProfile = profileMap[trip.organization_id ?? ''];
    organizationName =
      orgProfile?.organization_name || orgProfile?.full_name || organizationName;

    if (trip.assigned_driver_id) {
      const driverProfile = profileMap[trip.assigned_driver_id];
      driverName = driverProfile?.full_name || driverName;
    }
  }

  const modernLocationsResult = await auth.admin
    .from('trip_locations')
    .select(TRIP_LOCATION_SELECT_MODERN)
    .eq('trip_id', tripId)
    .order('recorded_at', { ascending: true });

  const locationsResult =
    modernLocationsResult.error &&
    isMissingTripLocationColumnError(modernLocationsResult.error.message)
      ? await auth.admin
          .from('trip_locations')
          .select(TRIP_LOCATION_SELECT_LEGACY)
          .eq('trip_id', tripId)
          .order('recorded_at', { ascending: true })
      : modernLocationsResult;

  if (locationsResult.error) {
    return NextResponse.json({ error: locationsResult.error.message }, { status: 500 });
  }

  const locations = locationsResult.data ?? [];

  const normalizedLocations = (locations ?? [])
    .map((row) => normalizeTripLocation(row))
    .filter((row): row is NonNullable<typeof row> => row !== null);

  return NextResponse.json({
    trip,
    organization_name: organizationName,
    driver_name: driverName,
    locations: normalizedLocations,
  });
}