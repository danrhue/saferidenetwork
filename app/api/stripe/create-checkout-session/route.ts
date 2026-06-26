import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import {
  createMarketplaceCheckoutSession,
  dollarsToCents,
  type ChargeType,
} from '@/lib/stripe';

export const dynamic = 'force-dynamic';

/** Trip fields sent from the Post a New Trip form */
interface TripCreatePayload {
  title: string;
  description?: string | null;
  pickup_location: string;
  dropoff_location: string;
  pickup_time: string;
  price: number;
  passengers?: number;
  start_lat?: number | null;
  start_lng?: number | null;
  end_lat?: number | null;
  end_lng?: number | null;
  distance_miles?: number | null;
  base_price?: number | null;
  peak_multiplier?: number | null;
  calculated_price?: number | null;
  final_price?: number | null;
  platform_fee?: number | null;
  total_price?: number | null;
}

/**
 * POST /api/stripe/create-checkout-session
 *
 * Two modes:
 * 1. New trip posting — send `trip` object: creates trip in Supabase, then Checkout session.
 * 2. Existing trip payment — send `tripId` + `chargeType`:
 *    - driver_compensation — retry abandoned posting payment (unpaid/failed)
 *    - platform_fee — charge platform fee at completion
 *    - destination_payout — combined payout when driver is assigned
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth) {
      return NextResponse.json(
        { error: 'Unauthorized — please sign in again and retry.' },
        { status: 401 }
      );
    }

    let admin;
    try {
      admin = getSupabaseAdmin();
    } catch {
      return NextResponse.json(
        {
          error:
            'Server configuration error: SUPABASE_SERVICE_ROLE_KEY is missing in Vercel environment variables.',
        },
        { status: 503 }
      );
    }

    // Verify caller is an organization account
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('role, organization_name')
      .eq('id', auth.user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    if (profile.role !== 'organization') {
      return NextResponse.json(
        { error: 'Only organization accounts can post trips and pay via Stripe.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const chargeType: ChargeType = body.chargeType ?? 'driver_compensation';

    let trip: {
      id: string;
      title: string;
      organization_id: string;
      assigned_driver_id: string | null;
      final_price: number | null;
      price: number | null;
      platform_fee: number | null;
      payment_status: string | null;
      platform_fee_status: string | null;
    };

    // -----------------------------------------------------------------------
    // Mode 1: Create new trip (Post a New Trip form)
    // -----------------------------------------------------------------------
    if (body.trip) {
      const payload = body.trip as TripCreatePayload;
      const validationError = validateTripPayload(payload);
      if (validationError) {
        return NextResponse.json({ error: validationError }, { status: 400 });
      }

      const finalPrice = payload.final_price ?? payload.price;

      const tripInsert = {
        organization_id: auth.user.id,
        title: payload.title.trim(),
        description: payload.description?.trim() || null,
        pickup_location: payload.pickup_location.trim(),
        dropoff_location: payload.dropoff_location.trim(),
        pickup_time: payload.pickup_time,
        price: finalPrice,
        final_price: finalPrice,
        status: 'open',
        payment_status: 'unpaid',
        platform_fee_status: 'unpaid',
        driver_payout_status: 'pending',
        passengers: payload.passengers ?? 1,
        start_lat: payload.start_lat ?? null,
        start_lng: payload.start_lng ?? null,
        end_lat: payload.end_lat ?? null,
        end_lng: payload.end_lng ?? null,
        distance_miles: payload.distance_miles ?? null,
        base_price: payload.base_price ?? null,
        peak_multiplier: payload.peak_multiplier ?? null,
        calculated_price: payload.calculated_price ?? null,
        platform_fee: payload.platform_fee ?? null,
        total_price: payload.total_price ?? null,
      };

      const { data: created, error: insertError } = await admin
        .from('trips')
        .insert(tripInsert)
        .select(
          'id, title, organization_id, assigned_driver_id, final_price, price, platform_fee, payment_status, platform_fee_status'
        )
        .single();

      if (insertError || !created) {
        console.error('Trip insert failed:', insertError);
        return NextResponse.json(
          {
            error: `Failed to create trip: ${insertError?.message ?? 'unknown database error'}. Check that your Supabase schema is up to date.`,
            details: insertError?.details ?? null,
            hint: insertError?.hint ?? null,
          },
          { status: 500 }
        );
      }

      trip = created;
    }
    // -----------------------------------------------------------------------
    // Mode 2: Existing trip (driver compensation retry, platform fee, payout)
    // -----------------------------------------------------------------------
    else if (body.tripId) {
      const { data: existing, error: tripError } = await admin
        .from('trips')
        .select(
          'id, title, organization_id, assigned_driver_id, final_price, price, platform_fee, payment_status, platform_fee_status'
        )
        .eq('id', body.tripId)
        .single();

      if (tripError || !existing) {
        console.error('Trip lookup failed:', tripError);
        return NextResponse.json(
          {
            error: `Trip not found (id: ${body.tripId}). ${tripError?.message ?? ''}`.trim(),
          },
          { status: 404 }
        );
      }

      if (existing.organization_id !== auth.user.id) {
        return NextResponse.json({ error: 'Forbidden — you do not own this trip.' }, { status: 403 });
      }

      trip = existing;

      if (chargeType === 'driver_compensation' && trip.payment_status === 'paid') {
        return NextResponse.json(
          { error: 'Driver compensation has already been paid for this trip.' },
          { status: 400 }
        );
      }

      if (chargeType === 'platform_fee' && trip.platform_fee_status === 'paid') {
        return NextResponse.json(
          { error: 'Platform fee has already been paid for this trip.' },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        { error: 'Request must include either a `trip` object (new posting) or `tripId` (existing trip).' },
        { status: 400 }
      );
    }

    // -----------------------------------------------------------------------
    // Create Stripe Checkout session
    // -----------------------------------------------------------------------
    const driverCompensation = trip.final_price ?? trip.price ?? 0;
    const platformFee = trip.platform_fee ?? 0;

    let amountCents = 0;
    let driverStripeAccountId: string | undefined;
    let platformFeeCents = 0;
    let driverPayoutCents = 0;

    if (chargeType === 'driver_compensation') {
      if (driverCompensation <= 0) {
        return NextResponse.json(
          { error: 'Invalid driver compensation amount. Enter a price greater than $0.' },
          { status: 400 }
        );
      }
      amountCents = dollarsToCents(driverCompensation);
    } else if (chargeType === 'platform_fee') {
      if (platformFee <= 0) {
        return NextResponse.json({ error: 'Invalid platform fee amount.' }, { status: 400 });
      }
      amountCents = dollarsToCents(platformFee);
    } else if (chargeType === 'destination_payout') {
      if (!trip.assigned_driver_id) {
        return NextResponse.json(
          { error: 'A driver must be assigned before destination payout.' },
          { status: 400 }
        );
      }

      const { data: driverProfile } = await admin
        .from('profiles')
        .select('stripe_account_id, stripe_charges_enabled')
        .eq('id', trip.assigned_driver_id)
        .single();

      if (!driverProfile?.stripe_account_id) {
        return NextResponse.json(
          { error: 'Assigned driver has not connected their Stripe account yet.' },
          { status: 400 }
        );
      }

      driverStripeAccountId = driverProfile.stripe_account_id;
      driverPayoutCents = dollarsToCents(driverCompensation);
      platformFeeCents = dollarsToCents(platformFee);
      amountCents = driverPayoutCents + platformFeeCents;
    } else {
      return NextResponse.json({ error: `Invalid chargeType: ${chargeType}` }, { status: 400 });
    }

    let session;
    try {
      session = await createMarketplaceCheckoutSession({
        tripId: trip.id,
        title: trip.title,
        amountCents,
        chargeType,
        organizationId: auth.user.id,
        driverStripeAccountId,
        platformFeeCents,
        driverPayoutCents,
      });
    } catch (stripeErr: unknown) {
      const message = stripeErr instanceof Error ? stripeErr.message : 'Stripe error';
      console.error('Stripe checkout session failed:', message);
      return NextResponse.json(
        { error: `Stripe checkout failed: ${message}. Verify STRIPE_SECRET_KEY is set in Vercel.` },
        { status: 502 }
      );
    }

    await admin
      .from('trips')
      .update({
        stripe_checkout_session_id: session.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', trip.id);

    return NextResponse.json({
      url: session.url,
      sessionId: session.id,
      tripId: trip.id,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('create-checkout-session error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function validateTripPayload(trip: TripCreatePayload): string | null {
  if (!trip.title?.trim()) return 'Trip title is required.';
  if (!trip.pickup_location?.trim()) return 'Pickup location is required.';
  if (!trip.dropoff_location?.trim()) return 'Dropoff location is required.';
  if (!trip.pickup_time) return 'Pickup time is required.';
  const price = trip.final_price ?? trip.price;
  if (!price || price <= 0) return 'A valid price greater than $0 is required.';
  return null;
}