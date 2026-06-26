import { NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const auth = await requireAdminUser();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { profileId, status, reason } = await request.json();

  if (!profileId || !['approved', 'rejected'].includes(status)) {
    return NextResponse.json({ error: 'Invalid profileId or status' }, { status: 400 });
  }

  if (status === 'rejected') {
    const trimmed = typeof reason === 'string' ? reason.trim() : '';
    if (!trimmed) {
      return NextResponse.json(
        { error: 'A rejection reason is required' },
        { status: 400 }
      );
    }
  }

  const { data: driver, error: driverError } = await auth.admin
    .from('profiles')
    .select('id, profile_photo_status, profile_photo_url')
    .eq('id', profileId)
    .eq('role', 'driver')
    .single();

  if (driverError || !driver) {
    return NextResponse.json({ error: 'Driver not found' }, { status: 404 });
  }

  if (driver.profile_photo_status !== 'pending' || !driver.profile_photo_url) {
    return NextResponse.json(
      { error: 'This driver does not have a pending profile photo' },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const updateData: {
    profile_photo_status: string;
    profile_photo_rejection_reason: string | null;
    updated_at: string;
  } = {
    profile_photo_status: status,
    profile_photo_rejection_reason:
      status === 'rejected' && typeof reason === 'string' ? reason.trim() : null,
    updated_at: now,
  };

  const { error } = await auth.admin
    .from('profiles')
    .update(updateData)
    .eq('id', profileId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}