/**
 * Rider auto-match buffer — start, cancel, finalize assignment flows.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { notifyAssignmentConfirmed } from '@/lib/rider/notifications';
import { finalizeRiderAutoMatchOffer } from '@/lib/rider/offers';

export type AutoMatchRpcResult = {
  ok: boolean;
  reason?: string;
  expires_at?: string;
};

/**
 * Starts the auto-match buffer via DB function when available.
 * Falls back to inline updates if RPC is missing.
 */
export async function startRiderAutoMatch(
  admin: SupabaseClient,
  params: { tripId: string; offerId: string; bufferSeconds: number }
): Promise<AutoMatchRpcResult> {
  const { tripId, offerId, bufferSeconds } = params;

  const { data, error } = await admin.rpc('start_rider_auto_match', {
    p_trip_id: tripId,
    p_offer_id: offerId,
    p_buffer_seconds: bufferSeconds,
  });

  if (!error && data) {
    const rpcResult = data as AutoMatchRpcResult;
    console.log('[AutoMatch] start_rider_auto_match RPC', { tripId, offerId, rpcResult });
    if (rpcResult.ok) {
      return rpcResult;
    }
    console.warn('[AutoMatch] RPC returned not ok, trying inline fallback:', rpcResult.reason);
  } else if (error) {
    console.warn('[AutoMatch] start_rider_auto_match RPC error, inline fallback:', error.message);
  }

  const expiresAt = new Date(Date.now() + bufferSeconds * 1000).toISOString();

  const { data: offerRow, error: offerError } = await admin
    .from('trip_offers')
    .update({ status: 'pending_confirmation' })
    .eq('id', offerId)
    .eq('status', 'pending')
    .select('id, status')
    .maybeSingle();

  if (offerError || !offerRow) {
    console.error('[AutoMatch] inline offer update failed', { tripId, offerId, offerError });
    return { ok: false, reason: offerError?.message ?? 'offer_not_pending' };
  }

  const { data: tripRow, error: tripError } = await admin
    .from('trips')
    .update({
      status: 'pending_assignment',
      assignment_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', tripId)
    .eq('status', 'open')
    .select('id, status, assignment_expires_at')
    .maybeSingle();

  if (tripError || !tripRow) {
    console.error('[AutoMatch] inline trip update failed', { tripId, tripError });
    await admin.from('trip_offers').update({ status: 'pending' }).eq('id', offerId);
    return { ok: false, reason: tripError?.message ?? 'trip_not_open' };
  }

  console.log('[AutoMatch] inline buffer started', { tripId, offerId, expiresAt, tripRow });
  return { ok: true, expires_at: expiresAt };
}

/**
 * Finalizes all expired rider assignment buffers.
 * Prefer DB function; inline fallback mirrors finalize_expired_rider_assignments().
 */
export async function finalizeExpiredRiderAssignments(admin: SupabaseClient): Promise<number> {
  const beforeFinalize = new Date().toISOString();
  const { data, error } = await admin.rpc('finalize_expired_rider_assignments');

  if (!error && typeof data === 'number') {
    if (data > 0) {
      // RPC path — notify riders for trips finalized in this batch
      const { data: assignedTrips } = await admin
        .from('trips')
        .select('id, rider_id, assigned_driver_id')
        .eq('trip_source', 'rider')
        .eq('status', 'assigned')
        .gte('updated_at', beforeFinalize);

      for (const t of assignedTrips ?? []) {
        if (t.rider_id && t.assigned_driver_id) {
          notifyAssignmentConfirmed(admin, t.id, t.assigned_driver_id).catch((err) =>
            console.error('assignment_confirmed notification failed:', err)
          );
        }
      }
    }
    return data;
  }

  console.warn('finalize_expired_rider_assignments RPC failed, using inline fallback:', error?.message);

  const now = new Date().toISOString();
  const { data: expiredTrips, error: fetchError } = await admin
    .from('trips')
    .select('id')
    .eq('status', 'pending_assignment')
    .lte('assignment_expires_at', now);

  if (fetchError || !expiredTrips?.length) {
    return 0;
  }

  let count = 0;
  for (const trip of expiredTrips) {
    const { data: pendingOffer } = await admin
      .from('trip_offers')
      .select('id, driver_id')
      .eq('trip_id', trip.id)
      .eq('status', 'pending_confirmation')
      .maybeSingle();

    if (!pendingOffer) continue;

    const finalized = await finalizeSingleExpiredAssignment(
      admin,
      trip.id,
      pendingOffer.id,
      pendingOffer.driver_id
    );
    if (finalized) {
      count += 1;
      notifyAssignmentConfirmed(admin, trip.id, pendingOffer.driver_id).catch((err) =>
        console.error('assignment_confirmed notification failed:', err)
      );
    }
  }

  return count;
}

/**
 * Finalizes one trip if its buffer has expired and the rider still owns it.
 * Used by the pending screen when the countdown reaches zero.
 */
export async function finalizeSingleExpiredAssignment(
  admin: SupabaseClient,
  tripId: string,
  offerId: string,
  driverId: string,
  riderId?: string
): Promise<boolean> {
  const result = await finalizeRiderAutoMatchOffer(admin, {
    tripId,
    offerId,
    driverId,
    riderId,
  });

  console.log('[AutoMatch] finalizeSingleExpiredAssignment', {
    tripId,
    offerId,
    driverId,
    ok: result.ok,
    reason: result.reason,
    error: result.error,
  });

  return result.ok;
}

/**
 * Rider declines the current auto-matched driver during the buffer window.
 */
export async function cancelRiderAssignmentDuringBuffer(
  admin: SupabaseClient,
  tripId: string,
  riderId: string
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const { data: trip, error: tripError } = await admin
    .from('trips')
    .select('id, rider_id, status, assignment_expires_at')
    .eq('id', tripId)
    .single();

  if (tripError || !trip) {
    return { ok: false, error: 'Trip not found.', status: 404 };
  }

  if (trip.rider_id !== riderId) {
    return { ok: false, error: 'Forbidden — not your trip.', status: 403 };
  }

  if (trip.status !== 'pending_assignment') {
    return { ok: false, error: 'This trip is not awaiting assignment confirmation.', status: 400 };
  }

  const { data: pendingOffer, error: offerError } = await admin
    .from('trip_offers')
    .select('id')
    .eq('trip_id', tripId)
    .eq('status', 'pending_confirmation')
    .maybeSingle();

  if (offerError) {
    return { ok: false, error: offerError.message, status: 500 };
  }

  if (!pendingOffer) {
    return { ok: false, error: 'No pending driver assignment found.', status: 400 };
  }

  const now = new Date().toISOString();

  const { error: declineError } = await admin
    .from('trip_offers')
    .update({ status: 'declined_by_rider', declined_at: now })
    .eq('id', pendingOffer.id);

  if (declineError) {
    return { ok: false, error: declineError.message, status: 500 };
  }

  const { error: tripUpdateError } = await admin
    .from('trips')
    .update({
      status: 'open',
      assignment_expires_at: null,
      updated_at: now,
    })
    .eq('id', tripId);

  if (tripUpdateError) {
    return { ok: false, error: tripUpdateError.message, status: 500 };
  }

  return { ok: true };
}