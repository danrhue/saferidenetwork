import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { acceptRiderTripOffer } from '@/lib/rider/offers';

export const dynamic = 'force-dynamic';

/**
 * POST /api/rider/offers/accept
 *
 * Assigns a driver to a rider trip (manual_review or auto-match confirm).
 * Body: { tripId: string, offerId: string }
 */
export async function POST(request: NextRequest) {
  let tripId = '';
  let offerId = '';

  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    tripId = typeof body.tripId === 'string' ? body.tripId.trim() : '';
    offerId = typeof body.offerId === 'string' ? body.offerId.trim() : '';

    console.log('[Rider] offers/accept: request', {
      tripId,
      offerId,
      riderId: auth.user.id,
    });

    if (!tripId || !offerId) {
      return NextResponse.json({ error: 'tripId and offerId are required.' }, { status: 400 });
    }

    let admin;
    try {
      admin = getSupabaseAdmin();
    } catch (configErr: unknown) {
      const message =
        configErr instanceof Error ? configErr.message : 'SUPABASE_SERVICE_ROLE_KEY missing';
      console.error('[Rider] offers/accept: service role error', message);
      return NextResponse.json({ error: message }, { status: 503 });
    }

    const result = await acceptRiderTripOffer(admin, {
      tripId,
      offerId,
      riderId: auth.user.id,
    });

    console.log('[Rider] offers/accept: result', {
      tripId,
      offerId,
      ok: result.ok,
      alreadyAssigned: result.alreadyAssigned,
      reason: result.reason,
      error: result.error,
      trip: result.trip,
      offer: result.offer,
      debug: result.debug,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, reason: result.reason, debug: result.debug },
        { status: result.status ?? 400 }
      );
    }

    return NextResponse.json({
      success: true,
      alreadyAssigned: result.alreadyAssigned ?? false,
      message: result.alreadyAssigned
        ? 'Driver was already assigned to this trip.'
        : 'Driver accepted. Other pending offers were declined.',
      trip: result.trip,
      offer: result.offer,
      reason: result.reason,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Accept offer failed';
    console.error('[Rider] offers/accept: unhandled error', { tripId, offerId, message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}