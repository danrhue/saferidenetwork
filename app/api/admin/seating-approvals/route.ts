import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { suggestPassengerCapacity } from '@/lib/vehicle-capacity';

export const dynamic = 'force-dynamic';

async function requireAdmin(admin: ReturnType<typeof getSupabaseAdmin>, userId: string) {
  const { data: profile, error } = await admin
    .from('profiles')
    .select('is_admin')
    .eq('id', userId)
    .single();

  if (error || !profile?.is_admin) return false;
  return true;
}

/**
 * GET /api/admin/seating-approvals?status=pending
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = getSupabaseAdmin();
    if (!(await requireAdmin(admin, auth.user.id))) {
      return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 });
    }

    const status = request.nextUrl.searchParams.get('status') || 'pending';

    const { data, error } = await admin
      .from('profiles')
      .select(
        'id, full_name, phone, vehicle_year, vehicle_make, vehicle_model, passenger_capacity, seating_override_note, seating_approval_status, seating_approved_at, updated_at'
      )
      .eq('role', 'driver')
      .eq('seating_approval_status', status)
      .order('updated_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const enriched = (data || []).map((row) => {
      const suggestion = suggestPassengerCapacity(
        row.vehicle_year,
        row.vehicle_make,
        row.vehicle_model
      );
      return {
        ...row,
        suggested_passengers: suggestion.suggestedPassengers,
        suggested_total_seats: suggestion.totalSeats,
        suggestion_message: suggestion.message,
      };
    });

    return NextResponse.json({ drivers: enriched });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/admin/seating-approvals
 * Body: { driverId, action: 'approve' | 'reject' }
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = getSupabaseAdmin();
    if (!(await requireAdmin(admin, auth.user.id))) {
      return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 });
    }

    const body = await request.json();
    const driverId = body.driverId as string | undefined;
    const action = body.action as string | undefined;

    if (!driverId) {
      return NextResponse.json({ error: 'driverId is required.' }, { status: 400 });
    }
    if (action !== 'approve' && action !== 'reject') {
      return NextResponse.json({ error: 'action must be approve or reject.' }, { status: 400 });
    }

    const { data: driver, error: driverError } = await admin
      .from('profiles')
      .select('id, seating_approval_status')
      .eq('id', driverId)
      .eq('role', 'driver')
      .single();

    if (driverError || !driver) {
      return NextResponse.json({ error: 'Driver not found.' }, { status: 404 });
    }

    if (driver.seating_approval_status !== 'pending') {
      return NextResponse.json(
        { error: 'This driver does not have a pending seating override.' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const { data: updated, error: updateError } = await admin
      .from('profiles')
      .update({
        seating_approval_status: action === 'approve' ? 'approved' : 'rejected',
        seating_approved_at: action === 'approve' ? now : null,
        updated_at: now,
      })
      .eq('id', driverId)
      .select(
        'id, full_name, passenger_capacity, seating_approval_status, seating_approved_at'
      )
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ driver: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}