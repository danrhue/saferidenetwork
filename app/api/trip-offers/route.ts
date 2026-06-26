import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import {
  canDriverSubmitOffers,
  tripFitsDriverCapacity,
  type DriverSeatingProfile,
} from '@/lib/seating-validation';
import {
  loadDriverOfferProfileGate,
  profileGateErrorResponse,
} from '@/lib/driver/offer-eligibility';
import { startRiderAutoMatch } from '@/lib/rider/assignment';
import { sendRiderNotification } from '@/lib/rider/notifications';

export const dynamic = 'force-dynamic';

const DRIVER_SEATING_SELECT =
  'role, vehicle_year, vehicle_make, vehicle_model, passenger_capacity, seating_override_note, seating_approval_status';

async function loadDriverProfile(admin: ReturnType<typeof getSupabaseAdmin>, userId: string) {
  const { data, error } = await admin
    .from('profiles')
    .select(DRIVER_SEATING_SELECT)
    .eq('id', userId)
    .single();
  return { data, error };
}

function validateDriverCanOffer(
  profile: DriverSeatingProfile & { role?: string },
  tripPassengers: number | null | undefined
): { ok: true } | { ok: false; error: string; status: number } {
  if (profile.role === 'organization') {
    return { ok: false, error: 'Only drivers can submit offers.', status: 403 };
  }

  const offerCheck = canDriverSubmitOffers(profile);
  if (!offerCheck.ok) {
    return { ok: false, error: offerCheck.error!, status: 403 };
  }

  const capacityCheck = tripFitsDriverCapacity(tripPassengers, profile.passenger_capacity);
  if (!capacityCheck.ok) {
    return { ok: false, error: capacityCheck.error!, status: 400 };
  }

  return { ok: true };
}

/**
 * POST /api/trip-offers — create offer on open, paid trip
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

    const body = await request.json();
    const tripId = body.tripId as string | undefined;
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    const offeredPriceRaw = body.offeredPrice;

    if (!tripId) {
      return NextResponse.json({ error: 'tripId is required.' }, { status: 400 });
    }

    let profileGate;
    try {
      profileGate = await loadDriverOfferProfileGate(admin, auth.user.id);
    } catch (gateErr: unknown) {
      const message = gateErr instanceof Error ? gateErr.message : 'Profile not found.';
      return NextResponse.json({ error: message }, { status: 404 });
    }

    if (!profileGate.isComplete) {
      return NextResponse.json(profileGateErrorResponse(profileGate), { status: 403 });
    }

    const { data: profile, error: profileError } = await loadDriverProfile(admin, auth.user.id);
    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found.' }, { status: 404 });
    }

    const { data: trip, error: tripError } = await admin
      .from('trips')
      .select(
        'id, status, payment_status, final_price, price, passengers, trip_source, matching_mode, rider_id'
      )
      .eq('id', tripId)
      .single();

    if (tripError || !trip) {
      return NextResponse.json({ error: 'Trip not found.' }, { status: 404 });
    }

    if (trip.status !== 'open') {
      return NextResponse.json(
        { error: 'This trip is no longer accepting offers.' },
        { status: 400 }
      );
    }

    if (trip.payment_status !== 'paid') {
      return NextResponse.json(
        { error: 'This trip is not yet available — organization payment is pending.' },
        { status: 400 }
      );
    }

    const seatingValidation = validateDriverCanOffer(profile, trip.passengers);
    if (!seatingValidation.ok) {
      return NextResponse.json(
        { error: seatingValidation.error },
        { status: seatingValidation.status }
      );
    }

    const tripRate = trip.final_price ?? trip.price ?? null;
    let offeredPrice: number | null = tripRate;

    if (offeredPriceRaw !== undefined && offeredPriceRaw !== null && offeredPriceRaw !== '') {
      const parsed = Number(offeredPriceRaw);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        return NextResponse.json(
          { error: 'Offered price must be a number greater than $0.' },
          { status: 400 }
        );
      }
      offeredPrice = parsed;
    }

    const { data: existing, error: existingError } = await admin
      .from('trip_offers')
      .select('id, status')
      .eq('trip_id', tripId)
      .eq('driver_id', auth.user.id)
      .maybeSingle();

    if (existingError) {
      console.error('Existing offer lookup failed:', existingError);
      return NextResponse.json({ error: existingError.message }, { status: 500 });
    }

    if (existing) {
      return NextResponse.json(
        {
          error: 'You already submitted an offer on this trip.',
          existingOfferId: existing.id,
          status: existing.status,
        },
        { status: 409 }
      );
    }

    // Count existing offers to detect first offer on rider auto-match trips
    const { count: offerCount, error: countError } = await admin
      .from('trip_offers')
      .select('id', { count: 'exact', head: true })
      .eq('trip_id', tripId);

    if (countError) {
      console.error('Offer count failed:', countError);
      return NextResponse.json({ error: countError.message }, { status: 500 });
    }

    const isFirstOffer = (offerCount ?? 0) === 0;
    const isRiderAutoMatch =
      trip.trip_source === 'rider' && trip.matching_mode === 'auto_first_offer';

    const { data: offer, error: insertError } = await admin
      .from('trip_offers')
      .insert({
        trip_id: tripId,
        driver_id: auth.user.id,
        message: message || null,
        offered_price: offeredPrice,
        status: 'pending',
      })
      .select('id, trip_id, driver_id, message, offered_price, status, created_at')
      .single();

    if (insertError) {
      console.error('Offer insert failed:', insertError);
      if (insertError.code === '23505') {
        return NextResponse.json(
          { error: 'You already submitted an offer on this trip.' },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // -----------------------------------------------------------------------
    // Rider auto-match: first offer starts the confirmation buffer
    // -----------------------------------------------------------------------
    let autoMatchStarted = false;
    let assignmentExpiresAt: string | null = null;
    let pendingAssignmentUrl: string | null = null;

    const isRiderManualReview =
      trip.trip_source === 'rider' && trip.matching_mode === 'manual_review';

    if (isRiderManualReview && trip.rider_id && offer) {
      const { data: driverProfile } = await admin
        .from('profiles')
        .select('full_name')
        .eq('id', auth.user.id)
        .single();

      sendRiderNotification(admin, {
        riderId: trip.rider_id,
        tripId,
        type: 'offer_received',
        metadata: {
          driverName: driverProfile?.full_name ?? undefined,
          offerId: offer.id,
        },
      }).catch((err) => console.error('offer_received notification failed:', err));
    }

    if (isRiderAutoMatch && isFirstOffer && offer) {
      let bufferSeconds = 60;

      if (trip.rider_id) {
        const { data: riderProfile } = await admin
          .from('profiles')
          .select('auto_match_buffer_seconds')
          .eq('id', trip.rider_id)
          .single();

        if (riderProfile?.auto_match_buffer_seconds) {
          bufferSeconds = riderProfile.auto_match_buffer_seconds;
        }
      }

      const matchResult = await startRiderAutoMatch(admin, {
        tripId,
        offerId: offer.id,
        bufferSeconds,
      });

      if (matchResult.ok) {
        autoMatchStarted = true;
        assignmentExpiresAt = matchResult.expires_at ?? null;
        pendingAssignmentUrl = `/rider/trips/${tripId}/pending`;

        // Notify rider: provisional assignment / buffer started
        if (trip.rider_id) {
          sendRiderNotification(admin, {
            riderId: trip.rider_id,
            tripId,
            type: 'buffer_started',
            metadata: { bufferSeconds },
          }).catch((err) => console.error('buffer_started notification failed:', err));
        }

        // Refresh offer status after buffer start
        const { data: updatedOffer } = await admin
          .from('trip_offers')
          .select('id, trip_id, driver_id, message, offered_price, status, created_at')
          .eq('id', offer.id)
          .single();

        if (updatedOffer) {
          return NextResponse.json({
            offer: updatedOffer,
            autoMatchStarted,
            assignmentExpiresAt,
            pendingAssignmentUrl,
          });
        }
      } else {
        console.error('[trip-offers] Auto-match buffer did not start', {
          tripId,
          offerId: offer.id,
          reason: matchResult.reason,
          trip_status: trip.status,
          matching_mode: trip.matching_mode,
        });
      }
    }

    return NextResponse.json({
      offer,
      autoMatchStarted,
      assignmentExpiresAt,
      pendingAssignmentUrl,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('trip-offers POST error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/trip-offers — update a pending offer (message / offered price)
 */
export async function PATCH(request: NextRequest) {
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

    const body = await request.json();
    const offerId = body.offerId as string | undefined;

    if (!offerId) {
      return NextResponse.json({ error: 'offerId is required.' }, { status: 400 });
    }

    const { data: offer, error: offerError } = await admin
      .from('trip_offers')
      .select('id, driver_id, trip_id, status')
      .eq('id', offerId)
      .single();

    if (offerError || !offer) {
      return NextResponse.json({ error: 'Offer not found.' }, { status: 404 });
    }

    if (offer.driver_id !== auth.user.id) {
      return NextResponse.json({ error: 'Forbidden — not your offer.' }, { status: 403 });
    }

    if (offer.status !== 'pending') {
      return NextResponse.json(
        { error: 'Only pending offers can be edited.' },
        { status: 400 }
      );
    }

    const { data: profile, error: profileError } = await loadDriverProfile(admin, auth.user.id);
    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found.' }, { status: 404 });
    }

    const { data: trip, error: tripError } = await admin
      .from('trips')
      .select('passengers, status, payment_status')
      .eq('id', offer.trip_id)
      .single();

    if (tripError || !trip) {
      return NextResponse.json({ error: 'Trip not found.' }, { status: 404 });
    }

    if (trip.status !== 'open' || trip.payment_status !== 'paid') {
      return NextResponse.json(
        { error: 'This trip is no longer accepting offer updates.' },
        { status: 400 }
      );
    }

    const seatingValidation = validateDriverCanOffer(profile, trip.passengers);
    if (!seatingValidation.ok) {
      return NextResponse.json(
        { error: seatingValidation.error },
        { status: seatingValidation.status }
      );
    }

    const updates: Record<string, unknown> = {};

    if (body.message !== undefined) {
      updates.message =
        typeof body.message === 'string' && body.message.trim() ? body.message.trim() : null;
    }

    if (body.offeredPrice !== undefined && body.offeredPrice !== null && body.offeredPrice !== '') {
      const parsed = Number(body.offeredPrice);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        return NextResponse.json(
          { error: 'Offered price must be a number greater than $0.' },
          { status: 400 }
        );
      }
      updates.offered_price = parsed;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update.' }, { status: 400 });
    }

    const { data: updated, error: updateError } = await admin
      .from('trip_offers')
      .update(updates)
      .eq('id', offerId)
      .select('id, trip_id, driver_id, message, offered_price, status, created_at')
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ offer: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('trip-offers PATCH error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}