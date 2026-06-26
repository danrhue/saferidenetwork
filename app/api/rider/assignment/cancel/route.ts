import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { cancelRiderAssignmentDuringBuffer } from '@/lib/rider/assignment';

export const dynamic = 'force-dynamic';

/**
 * POST /api/rider/assignment/cancel
 *
 * Rider declines the auto-matched driver during the confirmation buffer.
 * Trip returns to open; other drivers may submit offers.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized — please sign in again.' }, { status: 401 });
    }

    let admin;
    try {
      admin = getSupabaseAdmin();
    } catch {
      return NextResponse.json(
        { error: 'Server configuration error: SUPABASE_SERVICE_ROLE_KEY is missing.' },
        { status: 503 }
      );
    }

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('role')
      .eq('id', auth.user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found.' }, { status: 404 });
    }

    if (profile.role !== 'rider') {
      return NextResponse.json({ error: 'Only rider accounts can cancel assignments.' }, { status: 403 });
    }

    const body = await request.json();
    const tripId = body.tripId as string | undefined;

    if (!tripId) {
      return NextResponse.json({ error: 'tripId is required.' }, { status: 400 });
    }

    const result = await cancelRiderAssignmentDuringBuffer(admin, tripId, auth.user.id);

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      success: true,
      message: 'Driver declined. Your trip is open for new offers.',
      tripId,
      status: 'open',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('rider/assignment/cancel error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}