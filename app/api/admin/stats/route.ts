import { NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireAdminUser();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const admin = auth.admin;

  const [
    driversResult,
    pendingDocsResult,
    activeTripsResult,
    usersResult,
    orgsResult,
    pendingSeatingResult,
  ] = await Promise.all([
    admin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'driver')
      .is('deleted_at', null),
    admin
      .from('driver_documents')
      .select('*', { count: 'exact', head: true })
      .in('status', ['uploaded', 'pending_review']),
    admin
      .from('trips')
      .select('*', { count: 'exact', head: true })
      .in('status', ['assigned', 'in_progress'])
      .is('deleted_at', null),
    admin.from('profiles').select('*', { count: 'exact', head: true }).is('deleted_at', null),
    admin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'organization')
      .is('deleted_at', null),
    admin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'driver')
      .eq('seating_approval_status', 'pending')
      .is('deleted_at', null),
  ]);

  return NextResponse.json({
    totalDrivers: driversResult.count ?? 0,
    pendingDocuments: pendingDocsResult.count ?? 0,
    activeTrips: activeTripsResult.count ?? 0,
    totalUsers: usersResult.count ?? 0,
    totalOrganizations: orgsResult.count ?? 0,
    pendingSeating: pendingSeatingResult.count ?? 0,
  });
}