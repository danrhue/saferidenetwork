import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getStripe } from '@/lib/stripe';
import {
  findPaidCheckoutSessionForTrip,
  isRiderPortalTrip,
  stripeKeyMode,
  verifyCheckoutSessionAndMarkRiderTripPaid,
} from '@/lib/rider/stripe-payment';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * POST /api/rider/confirm-payment
 *
 * Webhook fallback: verifies Stripe Checkout server-side and marks trip paid + open.
 * Body: { tripId: string, sessionId?: string }
 */
export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  let tripId = '';
  let sessionId = '';

  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth) {
      console.warn('[Rider] confirm-payment: unauthorized');
      return NextResponse.json({ error: 'Unauthorized', paid: false }, { status: 401 });
    }

    const body = await request.json();
    tripId = typeof body.tripId === 'string' ? body.tripId.trim() : '';
    sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : '';

    const stripeMode = stripeKeyMode(process.env.STRIPE_SECRET_KEY);

    console.log('[Rider] confirm-payment: request', {
      tripId,
      sessionId: sessionId || '(resolve from trip row or Stripe search)',
      riderId: auth.user.id,
      stripeMode,
    });

    if (!tripId) {
      return NextResponse.json({ error: 'tripId is required', paid: false }, { status: 400 });
    }

    let admin;
    try {
      admin = getSupabaseAdmin();
    } catch (configErr: unknown) {
      const message =
        configErr instanceof Error ? configErr.message : 'SUPABASE_SERVICE_ROLE_KEY missing';
      console.error('[Rider] confirm-payment: service role unavailable', { tripId, message });
      return NextResponse.json(
        {
          error: `Server misconfigured: ${message}`,
          paid: false,
          debug: { tripId, stripeMode, reason: 'missing_service_role' },
        },
        { status: 503 }
      );
    }

    const { data: trip, error: tripError } = await admin
      .from('trips')
      .select(
        'id, rider_id, organization_id, trip_source, payment_status, status, stripe_checkout_session_id'
      )
      .eq('id', tripId)
      .maybeSingle();

    if (tripError || !trip) {
      console.error('[Rider] confirm-payment: trip load failed', {
        tripId,
        tripError: tripError?.message,
        code: tripError?.code,
      });
      return NextResponse.json({ error: 'Trip not found', paid: false }, { status: 404 });
    }

    console.log('[Rider] confirm-payment: trip row', {
      tripId,
      rider_id: trip.rider_id,
      trip_source: trip.trip_source,
      payment_status: trip.payment_status,
      status: trip.status,
      stripe_checkout_session_id: trip.stripe_checkout_session_id,
    });

    if (trip.rider_id !== auth.user.id) {
      console.warn('[Rider] confirm-payment: forbidden', {
        tripId,
        riderId: auth.user.id,
        tripRiderId: trip.rider_id,
      });
      return NextResponse.json({ error: 'Forbidden', paid: false }, { status: 403 });
    }

    if (!isRiderPortalTrip(trip)) {
      console.error('[Rider] confirm-payment: not a rider portal trip', {
        tripId,
        trip_source: trip.trip_source,
        rider_id: trip.rider_id,
        organization_id: trip.organization_id,
      });
      return NextResponse.json(
        {
          error: 'Not a rider trip — apply rider_portal_phase1.sql in Supabase',
          paid: false,
          debug: { tripId, trip_source: trip.trip_source },
        },
        { status: 400 }
      );
    }

    if (trip.payment_status === 'paid') {
      console.log('[Rider] confirm-payment: already paid', {
        tripId,
        payment_status: trip.payment_status,
        status: trip.status,
      });
      return NextResponse.json({
        paid: true,
        alreadyPaid: true,
        updated: false,
        trip: { id: trip.id, payment_status: trip.payment_status, status: trip.status },
        debug: { tripId, reason: 'already_paid', stripeMode },
      });
    }

    if (!sessionId) {
      sessionId = trip.stripe_checkout_session_id ?? '';
    }

    const stripe = getStripe();
    let result;

    if (sessionId) {
      result = await verifyCheckoutSessionAndMarkRiderTripPaid(admin, stripe, {
        tripId,
        riderId: auth.user.id,
        sessionId,
      });
    } else {
      console.warn('[Rider] confirm-payment: no session id on trip — searching Stripe', { tripId });
      const discovered = await findPaidCheckoutSessionForTrip(stripe, tripId);
      if (!discovered) {
        return NextResponse.json(
          {
            error: 'No checkout session found for this trip',
            paid: false,
            debug: {
              tripId,
              stripeMode,
              reason: 'no_session_id',
              hint: 'Complete checkout again or contact support with your trip ID',
            },
          },
          { status: 400 }
        );
      }
      sessionId = discovered.id;
      result = await verifyCheckoutSessionAndMarkRiderTripPaid(admin, stripe, {
        tripId,
        riderId: auth.user.id,
        sessionId,
      });
    }

    const elapsedMs = Date.now() - startedAt;

    console.log('[Rider] confirm-payment: result', {
      tripId,
      sessionId,
      paid: result.paid,
      alreadyPaid: result.alreadyPaid,
      updated: result.updated,
      reason: result.reason,
      updateError: result.updateError,
      sessionPaymentStatus: result.sessionPaymentStatus,
      sessionStatus: result.sessionStatus,
      paymentIntentStatus: result.paymentIntentStatus,
      stripeMode: result.stripeMode ?? stripeMode,
      trip: result.trip,
      elapsedMs,
    });

    return NextResponse.json({
      paid: result.paid,
      alreadyPaid: result.alreadyPaid,
      updated: result.updated,
      sessionPaymentStatus: result.sessionPaymentStatus,
      sessionStatus: result.sessionStatus,
      paymentIntentStatus: result.paymentIntentStatus,
      trip: result.trip,
      debug: {
        tripId,
        sessionId,
        stripeMode: result.stripeMode ?? stripeMode,
        reason: result.reason,
        updateError: result.updateError,
        elapsedMs,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Confirm payment failed';
    console.error('[Rider] confirm-payment: unhandled error', {
      tripId,
      sessionId,
      message,
      stack: err instanceof Error ? err.stack : undefined,
    });
    return NextResponse.json(
      {
        error: message,
        paid: false,
        debug: { tripId, sessionId, stripeMode: stripeKeyMode(process.env.STRIPE_SECRET_KEY) },
      },
      { status: 500 }
    );
  }
}