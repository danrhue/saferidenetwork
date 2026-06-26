import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import {
  finalizeExpiredRiderAssignments,
  finalizeSingleExpiredAssignment,
} from '@/lib/rider/assignment';

export const dynamic = 'force-dynamic';

function isAuthorizedCron(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;

  const authHeader = request.headers.get('authorization');
  if (authHeader === `Bearer ${cronSecret}`) return true;

  // Vercel Cron sends this header
  const vercelCron = request.headers.get('x-vercel-cron-secret');
  return vercelCron === cronSecret;
}

/**
 * GET /api/rider/assignment/finalize
 *
 * Cron endpoint — finalizes all expired rider auto-match buffers.
 * Protected by CRON_SECRET (Authorization: Bearer or x-vercel-cron-secret).
 *
 * POST /api/rider/assignment/finalize { tripId }
 *
 * Rider-authenticated — finalizes a single trip when its buffer has expired
 * (used by the pending screen countdown for immediate UX).
 */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return runBatchFinalize();
}

export async function POST(request: NextRequest) {
  // Cron may POST as well
  if (isAuthorizedCron(request)) {
    return runBatchFinalize();
  }

  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const tripId = body.tripId as string | undefined;

    if (!tripId) {
      return NextResponse.json({ error: 'tripId is required for rider finalize.' }, { status: 400 });
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

    const { data: trip, error: tripError } = await admin
      .from('trips')
      .select('id, rider_id, status, assignment_expires_at')
      .eq('id', tripId)
      .eq('rider_id', auth.user.id)
      .single();

    if (tripError || !trip) {
      return NextResponse.json({ error: 'Trip not found.' }, { status: 404 });
    }

    if (trip.status !== 'pending_assignment') {
      return NextResponse.json({ error: 'Trip is not pending assignment.' }, { status: 400 });
    }

    const expiresAt = trip.assignment_expires_at ? new Date(trip.assignment_expires_at).getTime() : 0;
    if (expiresAt > Date.now()) {
      return NextResponse.json({ error: 'Confirmation window has not expired yet.', status: 'pending' }, { status: 400 });
    }

    const { data: pendingOffer, error: offerError } = await admin
      .from('trip_offers')
      .select('id, driver_id')
      .eq('trip_id', tripId)
      .eq('status', 'pending_confirmation')
      .maybeSingle();

    if (offerError || !pendingOffer) {
      return NextResponse.json({ error: 'No pending offer to finalize.' }, { status: 400 });
    }

    const finalized = await finalizeSingleExpiredAssignment(
      admin,
      trip.id,
      pendingOffer.id,
      pendingOffer.driver_id,
      auth.user.id
    );

    if (!finalized) {
      return NextResponse.json({ error: 'Failed to finalize assignment.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      tripId: trip.id,
      status: 'assigned',
      assignedDriverId: pendingOffer.driver_id,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('rider/assignment/finalize POST error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function runBatchFinalize() {
  try {
    let admin;
    try {
      admin = getSupabaseAdmin();
    } catch {
      return NextResponse.json(
        { error: 'Server configuration error: SUPABASE_SERVICE_ROLE_KEY is missing.' },
        { status: 503 }
      );
    }

    const finalized = await finalizeExpiredRiderAssignments(admin);

    return NextResponse.json({
      success: true,
      finalized,
      ranAt: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('rider/assignment/finalize batch error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}