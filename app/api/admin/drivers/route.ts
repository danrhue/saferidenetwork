import { NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/admin-auth';
import { enrichDriverProfiles } from '@/lib/driver-profile';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await requireAdminUser();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const showDeleted = searchParams.get('showDeleted') === 'true';

  let query = auth.admin
    .from('profiles')
    .select('*')
    .eq('role', 'driver')
    .order('created_at', { ascending: false });

  if (showDeleted) {
    query = query.not('deleted_at', 'is', null);
  } else {
    query = query.is('deleted_at', null);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Drivers fetch error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const drivers = await enrichDriverProfiles(auth.admin, data ?? []);

  const { data: pendingDocs, error: pendingError } = await auth.admin
    .from('driver_documents')
    .select('driver_id')
    .in('status', ['uploaded', 'pending_review']);

  if (pendingError) {
    console.error('Pending documents count error:', pendingError);
  }

  const pendingByDriver: Record<string, number> = {};
  (pendingDocs ?? []).forEach((doc) => {
    pendingByDriver[doc.driver_id] = (pendingByDriver[doc.driver_id] ?? 0) + 1;
  });

  const driversWithPending = drivers
    .map((driver) => ({
      ...driver,
      pendingDocuments: pendingByDriver[driver.id] ?? 0,
    }))
    .sort((a, b) => {
      if (b.pendingDocuments !== a.pendingDocuments) {
        return b.pendingDocuments - a.pendingDocuments;
      }
      return (
        new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
      );
    });

  return NextResponse.json(driversWithPending);
}