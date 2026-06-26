import { NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const auth = await requireAdminUser();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { profileId, status, note } = await request.json();

  if (!profileId || !['approved', 'rejected'].includes(status)) {
    return NextResponse.json({ error: 'Invalid profileId or status' }, { status: 400 });
  }

  const { data: driver, error: driverError } = await auth.admin
    .from('profiles')
    .select('id, seating_approval_status')
    .eq('id', profileId)
    .eq('role', 'driver')
    .single();

  if (driverError || !driver) {
    return NextResponse.json({ error: 'Driver not found' }, { status: 404 });
  }

  if (driver.seating_approval_status !== 'pending') {
    return NextResponse.json({ error: 'This driver does not have a pending seating review' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const updateData: {
    seating_approval_status: string;
    seating_approved_at: string | null;
    updated_at: string;
    seating_override_note?: string;
  } = {
    seating_approval_status: status,
    seating_approved_at: status === 'approved' ? now : null,
    updated_at: now,
  };

  if (typeof note === 'string' && note.trim()) {
    updateData.seating_override_note = note.trim();
  }

  const { error } = await auth.admin
    .from('profiles')
    .update(updateData)
    .eq('id', profileId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}