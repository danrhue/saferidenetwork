import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { APP_URL, createRiderCheckoutSession, dollarsToCents } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

type MatchingMode = 'auto_first_offer' | 'manual_review';
type ScheduleMode = 'asap' | 'scheduled';

interface RiderTripPayload {
  pickup_location: string;
  dropoff_location: string;
  pickup_time: string;
  schedule_mode?: ScheduleMode;
  passengers?: number;
  description?: string | null;
  accessibility_notes?: string | null;
  matching_mode: MatchingMode;
  policy_acknowledged_at: string;
  distance_miles?: number | null;
  base_price?: number | null;
  peak_multiplier?: number | null;
  calculated_price?: number | null;
  final_price?: number | null;
  platform_fee?: number | null;
  total_price?: number | null;
  start_lat?: number | null;
  start_lng?: number | null;
  end_lat?: number | null;
  end_lng?: number | null;
}

/**
 * POST /api/rider/create-checkout-session
 *
 * Two modes:
 * 1. New trip — send `trip` object from the wizard (creates row, then Checkout).
 * 2. Resume payment — send `tripId` for an existing unpaid rider trip.
 *
 * Stripe session metadata (read by webhook):
 *   trip_id, trip_source: 'rider', user_id, charge_type: 'rider_trip_payment'
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
      .select('role, full_name')
      .eq('id', auth.user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    if (profile.role !== 'rider') {
      return NextResponse.json({ error: 'Only rider accounts can request rides via this endpoint.' }, { status: 403 });
    }

    const body = await request.json();

    let tripId: string;
    let tripTitle: string;
    let totalPrice: number;
    let cancelUrl: string | undefined;
    let isNewTrip = false;

    // -----------------------------------------------------------------------
    // Mode 1: Resume payment on an existing unpaid trip
    // -----------------------------------------------------------------------
    if (body.tripId) {
      const { data: existing, error: tripError } = await admin
        .from('trips')
        .select(
          'id, title, rider_id, trip_source, payment_status, status, total_price, final_price, calculated_price'
        )
        .eq('id', body.tripId)
        .single();

      if (tripError || !existing) {
        return NextResponse.json({ error: 'Trip not found.' }, { status: 404 });
      }

      if (existing.rider_id !== auth.user.id) {
        return NextResponse.json({ error: 'You do not have access to this trip.' }, { status: 403 });
      }

      if (existing.trip_source !== 'rider') {
        return NextResponse.json({ error: 'This trip cannot be paid via the rider checkout flow.' }, { status: 400 });
      }

      if (existing.payment_status === 'paid') {
        return NextResponse.json({ error: 'This trip has already been paid.' }, { status: 400 });
      }

      if (existing.status === 'cancelled') {
        return NextResponse.json({ error: 'Cancelled trips cannot be paid.' }, { status: 400 });
      }

      totalPrice =
        existing.total_price ?? existing.final_price ?? existing.calculated_price ?? 0;

      if (totalPrice <= 0) {
        return NextResponse.json(
          { error: 'Trip price is missing or invalid. Please request a new ride.' },
          { status: 400 }
        );
      }

      tripId = existing.id;
      tripTitle = existing.title;
      cancelUrl = `${APP_URL}/rider/trips/${existing.id}?cancelled=true`;
    }
    // -----------------------------------------------------------------------
    // Mode 2: New trip from wizard
    // -----------------------------------------------------------------------
    else if (body.trip) {
      isNewTrip = true;
      const payload = body.trip as RiderTripPayload;
      const validationError = validateRiderTripPayload(payload);
      if (validationError) {
        return NextResponse.json({ error: validationError }, { status: 400 });
      }

      const driverCompensation = payload.final_price ?? payload.calculated_price ?? 0;
      totalPrice = payload.total_price ?? driverCompensation + (payload.platform_fee ?? 0);

      if (totalPrice <= 0 || driverCompensation <= 0) {
        return NextResponse.json({ error: 'A valid price greater than $0 is required.' }, { status: 400 });
      }

      const pickupShort = truncateLocation(payload.pickup_location);
      const dropoffShort = truncateLocation(payload.dropoff_location);
      tripTitle = `Ride: ${pickupShort} → ${dropoffShort}`;

      const descriptionParts = [payload.description?.trim(), payload.accessibility_notes?.trim()].filter(Boolean);
      const description = descriptionParts.length > 0 ? descriptionParts.join('\n\n') : null;

      // Hidden from drivers until Stripe webhook (or confirm-payment) sets paid + open
      const tripInsert = {
        organization_id: null,
        rider_id: auth.user.id,
        trip_source: 'rider',
        title: tripTitle,
        description,
        pickup_location: payload.pickup_location.trim(),
        dropoff_location: payload.dropoff_location.trim(),
        pickup_time: payload.pickup_time,
        price: driverCompensation,
        final_price: driverCompensation,
        total_price: totalPrice,
        platform_fee: payload.platform_fee ?? null,
        calculated_price: payload.calculated_price ?? null,
        base_price: payload.base_price ?? null,
        peak_multiplier: payload.peak_multiplier ?? null,
        distance_miles: payload.distance_miles ?? null,
        passengers: payload.passengers ?? 1,
        matching_mode: payload.matching_mode,
        schedule_mode: payload.schedule_mode === 'asap' ? 'asap' : 'scheduled',
        policy_acknowledged_at: payload.policy_acknowledged_at,
        start_lat: payload.start_lat ?? null,
        start_lng: payload.start_lng ?? null,
        end_lat: payload.end_lat ?? null,
        end_lng: payload.end_lng ?? null,
        status: 'awaiting_payment',
        payment_status: 'awaiting_payment',
        platform_fee_status: 'unpaid',
        driver_payout_status: 'pending',
      };

      const { data: created, error: insertError } = await admin
        .from('trips')
        .insert(tripInsert)
        .select('id, title')
        .single();

      if (insertError || !created) {
        console.error('Rider trip insert failed:', insertError);
        return NextResponse.json(
          {
            error: `Failed to create trip: ${insertError?.message ?? 'unknown database error'}.`,
            details: insertError?.details ?? null,
            hint: insertError?.hint ?? null,
          },
          { status: 500 }
        );
      }

      tripId = created.id;
      tripTitle = created.title;
      console.log(`[Rider] Created trip ${tripId} awaiting payment for rider ${auth.user.id}`);
    } else {
      return NextResponse.json(
        { error: 'Request must include either `trip` (new ride) or `tripId` (resume payment).' },
        { status: 400 }
      );
    }

    let session;
    try {
      session = await createRiderCheckoutSession({
        tripId,
        title: tripTitle,
        amountCents: dollarsToCents(totalPrice),
        riderId: auth.user.id,
        cancelUrl,
      });
    } catch (stripeErr: unknown) {
      const message = stripeErr instanceof Error ? stripeErr.message : 'Stripe error';
      console.error('Rider Stripe checkout failed:', message);

      if (isNewTrip) {
        await admin.from('trips').delete().eq('id', tripId);
      }

      return NextResponse.json({ error: `Stripe checkout failed: ${message}` }, { status: 502 });
    }

    // Mark trip as awaiting checkout completion
    const { error: updateError } = await admin
      .from('trips')
      .update({
        payment_status: 'awaiting_payment',
        stripe_checkout_session_id: session.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', tripId);

    if (updateError) {
      console.error(`[Rider] Failed to attach checkout session to trip ${tripId}:`, updateError);
    }

    console.log(`[Rider] Checkout session created`, {
      tripId,
      sessionId: session.id,
      metadata: {
        trip_id: tripId,
        trip_source: 'rider',
        user_id: auth.user.id,
        charge_type: 'rider_trip_payment',
      },
    });

    return NextResponse.json({
      url: session.url,
      sessionId: session.id,
      tripId,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('rider/create-checkout-session error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function validateRiderTripPayload(trip: RiderTripPayload | undefined): string | null {
  if (!trip) return 'Trip payload is required.';
  if (!trip.pickup_location?.trim()) return 'Pickup location is required.';
  if (!trip.dropoff_location?.trim()) return 'Dropoff location is required.';
  if (trip.pickup_location.trim().toLowerCase() === trip.dropoff_location.trim().toLowerCase()) {
    return 'Pickup and dropoff must be different locations.';
  }
  if (!trip.pickup_time) return 'Pickup date and time are required.';
  const pickupDate = new Date(trip.pickup_time);
  if (Number.isNaN(pickupDate.getTime())) return 'Invalid pickup date/time.';
  if (pickupDate.getTime() < Date.now() - 60_000) return 'Pickup time must be in the future.';
  if (!trip.matching_mode || !['auto_first_offer', 'manual_review'].includes(trip.matching_mode)) {
    return 'A valid matching preference is required.';
  }
  if (!trip.policy_acknowledged_at) {
    return 'You must acknowledge the cancel and refund policy before payment.';
  }
  const passengers = trip.passengers ?? 1;
  if (passengers < 1 || passengers > 8) return 'Passengers must be between 1 and 8.';
  return null;
}

function truncateLocation(location: string, maxLen = 40): string {
  const trimmed = location.trim();
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, maxLen - 1)}…`;
}