import { NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

const TRIP_LIST_SELECT =
  'id, status, created_at, organization_id, assigned_driver_id, pickup_location, dropoff_location, deleted_at, deleted_by, title, pickup_time, rider_id';

export async function GET(request: Request) {
  const auth = await requireAdminUser();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const showDeleted = searchParams.get('showDeleted') === 'true';
  const status = searchParams.get('status');

  let query = auth.admin.from('trips').select(TRIP_LIST_SELECT);

  if (!showDeleted) {
    query = query.is('deleted_at', null);
  } else {
    query = query.not('deleted_at', 'is', null);
  }

  if (status) {
    query = query.eq('status', status);
  }

  const { data: trips, error } = await query.order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = trips ?? [];
  const profileIds = Array.from(
    new Set(
      rows
        .flatMap((t) => [t.organization_id, t.assigned_driver_id, t.rider_id])
        .filter(Boolean) as string[]
    )
  );

  let profileMap: Record<string, { full_name?: string | null; organization_name?: string | null }> =
    {};

  if (profileIds.length > 0) {
    const { data: profiles } = await auth.admin
      .from('profiles')
      .select('id, full_name, organization_name')
      .in('id', profileIds);

    profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));
  }

  const enriched = rows.map((trip) => ({
    ...trip,
    driver_id: trip.assigned_driver_id,
    pickup_address: trip.pickup_location,
    dropoff_address: trip.dropoff_location,
    organization_name:
      profileMap[trip.organization_id ?? '']?.organization_name ||
      profileMap[trip.organization_id ?? '']?.full_name ||
      null,
    driver_name: profileMap[trip.assigned_driver_id ?? '']?.full_name ?? null,
    rider_name: profileMap[trip.rider_id ?? '']?.full_name ?? null,
  }));

  return NextResponse.json(enriched);
}