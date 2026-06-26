/**
 * Rider offer acceptance — manual review + auto-match assignment (service role).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { notifyAssignmentConfirmed } from '@/lib/rider/notifications';

export interface AssignDriverToRiderTripResult {
  ok: boolean;
  alreadyAssigned?: boolean;
  error?: string;
  status?: number;
  reason?: string;
  trip?: {
    id: string;
    status: string;
    assigned_driver_id: string | null;
    title: string;
    matching_mode?: string | null;
  };
  offer?: { id: string; driver_id: string; status: string };
  debug?: Record<string, unknown>;
}

const ASSIGNABLE_OFFER_STATUSES = ['pending', 'pending_confirmation'] as const;

/**
 * Core idempotent assignment: approve one offer, assign driver, reject others.
 * Used by manual accept, auto-match finalize, and early confirm.
 */
export async function assignDriverToRiderTrip(
  admin: SupabaseClient,
  params: { tripId: string; offerId: string; riderId: string; source?: string }
): Promise<AssignDriverToRiderTripResult> {
  const { tripId, offerId, riderId, source = 'assign' } = params;
  const now = new Date().toISOString();

  console.log('[RiderOffers] assignDriverToRiderTrip: start', {
    tripId,
    offerId,
    riderId,
    source,
  });

  const { data: offer, error: offerError } = await admin
    .from('trip_offers')
    .select('id, trip_id, driver_id, status')
    .eq('id', offerId)
    .maybeSingle();

  if (offerError) {
    console.error('[RiderOffers] offer load error', { tripId, offerId, offerError });
    return { ok: false, error: offerError.message, status: 500, reason: 'offer_load_error' };
  }

  if (!offer) {
    return { ok: false, error: 'Offer not found.', status: 404, reason: 'offer_not_found' };
  }

  if (offer.trip_id !== tripId) {
    return { ok: false, error: 'Offer does not belong to this trip.', status: 400, reason: 'offer_trip_mismatch' };
  }

  const { data: trip, error: tripError } = await admin
    .from('trips')
    .select(
      'id, rider_id, status, assigned_driver_id, title, matching_mode, trip_source, payment_status, assignment_expires_at'
    )
    .eq('id', tripId)
    .maybeSingle();

  if (tripError) {
    console.error('[RiderOffers] trip load error', { tripId, tripError });
    return { ok: false, error: tripError.message, status: 500, reason: 'trip_load_error' };
  }

  if (!trip) {
    return { ok: false, error: 'Trip not found.', status: 404, reason: 'trip_not_found' };
  }

  console.log('[RiderOffers] pre-assign state', {
    tripId,
    offerId,
    trip_status: trip.status,
    trip_matching_mode: trip.matching_mode,
    trip_assigned_driver_id: trip.assigned_driver_id,
    offer_status: offer.status,
    offer_driver_id: offer.driver_id,
    payment_status: trip.payment_status,
  });

  if (trip.rider_id !== riderId) {
    return { ok: false, error: 'Forbidden — not your trip.', status: 403, reason: 'forbidden' };
  }

  if (trip.trip_source !== 'rider') {
    return { ok: false, error: 'Not a rider portal trip.', status: 400, reason: 'not_rider_trip' };
  }

  if (trip.payment_status !== 'paid') {
    return {
      ok: false,
      error: 'Trip payment must be completed before assigning a driver.',
      status: 400,
      reason: 'unpaid',
    };
  }

  // Idempotent: already assigned to this driver
  if (
    trip.status === 'assigned' &&
    trip.assigned_driver_id === offer.driver_id &&
    (offer.status === 'approved' || ASSIGNABLE_OFFER_STATUSES.includes(offer.status as (typeof ASSIGNABLE_OFFER_STATUSES)[number]))
  ) {
    if (offer.status !== 'approved') {
      await admin.from('trip_offers').update({ status: 'approved' }).eq('id', offerId);
    }
    console.log('[RiderOffers] already assigned (idempotent)', { tripId, offerId });
    return {
      ok: true,
      alreadyAssigned: true,
      trip: {
        id: trip.id,
        status: 'assigned',
        assigned_driver_id: trip.assigned_driver_id,
        title: trip.title,
        matching_mode: trip.matching_mode,
      },
      offer: { id: offer.id, driver_id: offer.driver_id, status: 'approved' },
      reason: 'already_assigned',
    };
  }

  if (trip.assigned_driver_id && trip.assigned_driver_id !== offer.driver_id) {
    return {
      ok: false,
      error: 'This trip already has a different driver assigned.',
      status: 400,
      reason: 'different_driver_assigned',
    };
  }

  if (!ASSIGNABLE_OFFER_STATUSES.includes(offer.status as (typeof ASSIGNABLE_OFFER_STATUSES)[number])) {
    return {
      ok: false,
      error: `Offer status "${offer.status}" cannot be accepted.`,
      status: 400,
      reason: 'invalid_offer_status',
    };
  }

  const isManual = trip.matching_mode === 'manual_review';
  const isAuto = trip.matching_mode === 'auto_first_offer';

  if (isManual) {
    if (trip.status !== 'open') {
      return {
        ok: false,
        error: `Manual review trips must be open to accept offers (current: ${trip.status}).`,
        status: 400,
        reason: 'manual_trip_not_open',
      };
    }
    if (offer.status !== 'pending') {
      return {
        ok: false,
        error: 'Manual review requires a pending driver offer.',
        status: 400,
        reason: 'manual_offer_not_pending',
      };
    }
  } else if (isAuto) {
    if (offer.status === 'pending_confirmation') {
      if (!['open', 'pending_assignment'].includes(trip.status)) {
        return {
          ok: false,
          error: `Auto-match confirmation requires open or pending_assignment (current: ${trip.status}).`,
          status: 400,
          reason: 'auto_invalid_trip_status',
        };
      }
    } else if (offer.status === 'pending') {
      // First offer before buffer started — assign directly if trip still open
      if (trip.status !== 'open') {
        return {
          ok: false,
          error: `Auto-match pending offer requires trip open (current: ${trip.status}).`,
          status: 400,
          reason: 'auto_pending_trip_not_open',
        };
      }
    }
  } else {
    return {
      ok: false,
      error: `Unknown matching mode: ${trip.matching_mode}`,
      status: 400,
      reason: 'unknown_matching_mode',
    };
  }

  const { error: approveError } = await admin
    .from('trip_offers')
    .update({ status: 'approved' })
    .eq('id', offerId);

  if (approveError) {
    console.error('[RiderOffers] approve offer failed', { tripId, offerId, approveError });
    return { ok: false, error: approveError.message, status: 500, reason: 'approve_failed' };
  }

  const { data: updatedTrip, error: tripUpdateError } = await admin
    .from('trips')
    .update({
      status: 'assigned',
      assigned_driver_id: offer.driver_id,
      assignment_expires_at: null,
      updated_at: now,
    })
    .eq('id', tripId)
    .select('id, status, assigned_driver_id, title, matching_mode')
    .maybeSingle();

  if (tripUpdateError || !updatedTrip) {
    console.error('[RiderOffers] trip assign failed', { tripId, offerId, tripUpdateError });
    await admin
      .from('trip_offers')
      .update({ status: offer.status })
      .eq('id', offerId);
    return {
      ok: false,
      error: `Failed to assign driver: ${tripUpdateError?.message ?? 'no rows updated'}`,
      status: 500,
      reason: 'trip_assign_failed',
      debug: { tripUpdateError: tripUpdateError?.message },
    };
  }

  const { error: rejectError } = await admin
    .from('trip_offers')
    .update({ status: 'rejected' })
    .eq('trip_id', tripId)
    .neq('id', offerId)
    .in('status', ['pending', 'pending_confirmation']);

  if (rejectError) {
    console.warn('[RiderOffers] reject other offers failed', { tripId, rejectError });
  }

  notifyAssignmentConfirmed(admin, tripId, offer.driver_id).catch((err) =>
    console.error('[RiderOffers] assignment_confirmed notification failed:', err)
  );

  console.log('[RiderOffers] assignDriverToRiderTrip: success', {
    tripId,
    offerId,
    driverId: offer.driver_id,
    source,
    trip: updatedTrip,
  });

  return {
    ok: true,
    trip: updatedTrip,
    offer: { id: offer.id, driver_id: offer.driver_id, status: 'approved' },
    reason: 'assigned',
  };
}

/** Rider accepts a driver offer (manual review or auto-match confirm). */
export async function acceptRiderTripOffer(
  admin: SupabaseClient,
  params: { tripId: string; offerId: string; riderId: string }
): Promise<AssignDriverToRiderTripResult> {
  return assignDriverToRiderTrip(admin, {
    ...params,
    source: 'rider_accept',
  });
}

/** Auto-match: finalize assignment for a pending_confirmation offer. */
export async function finalizeRiderAutoMatchOffer(
  admin: SupabaseClient,
  params: { tripId: string; offerId: string; driverId: string; riderId?: string }
): Promise<AssignDriverToRiderTripResult> {
  if (params.riderId) {
    return assignDriverToRiderTrip(admin, {
      tripId: params.tripId,
      offerId: params.offerId,
      riderId: params.riderId,
      source: 'auto_finalize',
    });
  }

  const { data: trip } = await admin
    .from('trips')
    .select('rider_id')
    .eq('id', params.tripId)
    .maybeSingle();

  if (!trip?.rider_id) {
    return { ok: false, error: 'Trip has no rider.', status: 400, reason: 'no_rider' };
  }

  return assignDriverToRiderTrip(admin, {
    tripId: params.tripId,
    offerId: params.offerId,
    riderId: trip.rider_id,
    source: 'auto_finalize_cron',
  });
}

/** Rough ETA label for offer cards (pickup time + offer age). */
export function formatOfferEta(params: {
  pickupTime: string | null;
  offerCreatedAt: string;
  distanceMiles?: number | null;
}): string {
  const pickup = params.pickupTime ? new Date(params.pickupTime) : null;
  const offered = new Date(params.offerCreatedAt);
  const now = new Date();

  const minutesAgo = Math.max(0, Math.round((now.getTime() - offered.getTime()) / 60_000));
  const offeredLabel =
    minutesAgo < 1 ? 'Just submitted' : `Offered ${minutesAgo} min ago`;

  if (pickup && pickup.getTime() > now.getTime()) {
    const hoursUntil = Math.round((pickup.getTime() - now.getTime()) / 3_600_000);
    if (hoursUntil >= 2) {
      return `${offeredLabel} · Pickup in ~${hoursUntil}h`;
    }
    const minsUntil = Math.round((pickup.getTime() - now.getTime()) / 60_000);
    return `${offeredLabel} · Pickup in ~${minsUntil} min`;
  }

  if (params.distanceMiles != null && params.distanceMiles > 0) {
    const driveMins = Math.max(5, Math.round(params.distanceMiles * 2.5));
    return `${offeredLabel} · ~${driveMins} min to pickup area`;
  }

  return offeredLabel;
}