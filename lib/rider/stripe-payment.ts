import type { SupabaseClient } from '@supabase/supabase-js';
import type Stripe from 'stripe';

/** Stripe Checkout / PaymentIntent metadata for rider trips */
export const RIDER_CHECKOUT_METADATA = {
  tripSource: 'rider',
  chargeType: 'rider_trip_payment',
} as const;

export function tripIdFromStripeMetadata(
  metadata: Stripe.Metadata | null | undefined
): string | undefined {
  return metadata?.trip_id ?? metadata?.tripId;
}

export function tripSourceFromStripeMetadata(
  metadata: Stripe.Metadata | null | undefined
): string | undefined {
  return metadata?.trip_source ?? metadata?.tripSource;
}

export function chargeTypeFromStripeMetadata(
  metadata: Stripe.Metadata | null | undefined
): string | undefined {
  return metadata?.charge_type ?? metadata?.chargeType;
}

export function isRiderStripePayment(metadata: Stripe.Metadata | null | undefined): boolean {
  const source = tripSourceFromStripeMetadata(metadata);
  const chargeType = chargeTypeFromStripeMetadata(metadata);
  return (
    source === RIDER_CHECKOUT_METADATA.tripSource ||
    chargeType === RIDER_CHECKOUT_METADATA.chargeType
  );
}

/** True when a DB row represents a rider-portal trip (not org-posted). */
export function isRiderPortalTrip(trip: {
  trip_source?: string | null;
  rider_id?: string | null;
  organization_id?: string | null;
}): boolean {
  if (trip.trip_source === 'rider') return true;
  if (trip.rider_id && !trip.organization_id) return true;
  return false;
}

export function stripeKeyMode(secretKey: string | undefined): 'test' | 'live' | 'unknown' {
  if (!secretKey) return 'unknown';
  if (secretKey.startsWith('sk_test_')) return 'test';
  if (secretKey.startsWith('sk_live_')) return 'live';
  return 'unknown';
}

export function resolvePaymentIntentFromSession(
  session: Stripe.Checkout.Session
): Stripe.PaymentIntent | string | null {
  if (!session.payment_intent) return null;
  if (typeof session.payment_intent === 'string') return session.payment_intent;
  return session.payment_intent;
}

/**
 * Lenient paid check for Checkout Sessions — important in test/sandbox where
 * payment_status can lag briefly behind payment_intent.status = succeeded.
 */
export function isStripeCheckoutSessionPaid(
  session: Stripe.Checkout.Session,
  paymentIntent?: Stripe.PaymentIntent | { status?: string } | null
): boolean {
  if (session.payment_status === 'paid' || session.payment_status === 'no_payment_required') {
    return true;
  }

  if (paymentIntent?.status === 'succeeded') {
    return true;
  }

  if (session.status === 'complete' && paymentIntent?.status === 'succeeded') {
    return true;
  }

  return false;
}

export interface MarkRiderTripPaidInput {
  tripId: string;
  sessionId?: string | null;
  paymentIntentId?: string | null;
}

export interface MarkRiderTripPaidResult {
  updated: boolean;
  trip: { id: string; payment_status: string | null; status: string | null } | null;
  reason?: string;
  updateError?: string;
  usedMinimalUpdate?: boolean;
}

/**
 * Idempotent service-role update: mark a rider trip paid and open for driver offers.
 * Used by the Stripe webhook and the client confirm-payment fallback.
 */
export async function markRiderTripPaid(
  admin: SupabaseClient,
  input: MarkRiderTripPaidInput
): Promise<MarkRiderTripPaidResult> {
  const now = new Date().toISOString();

  console.log('[RiderPayment] markRiderTripPaid: start', {
    tripId: input.tripId,
    sessionId: input.sessionId ?? null,
    paymentIntentId: input.paymentIntentId ?? null,
  });

  const { data: existing, error: loadError } = await admin
    .from('trips')
    .select('id, trip_source, rider_id, organization_id, payment_status, status')
    .eq('id', input.tripId)
    .maybeSingle();

  if (loadError) {
    console.error('[RiderPayment] markRiderTripPaid: load failed', {
      tripId: input.tripId,
      code: loadError.code,
      message: loadError.message,
      details: loadError.details,
    });
    throw loadError;
  }

  if (!existing) {
    console.error('[RiderPayment] markRiderTripPaid: trip not found', { tripId: input.tripId });
    return { updated: false, trip: null, reason: 'trip_not_found' };
  }

  console.log('[RiderPayment] markRiderTripPaid: existing row', {
    tripId: input.tripId,
    trip_source: existing.trip_source,
    rider_id: existing.rider_id,
    payment_status: existing.payment_status,
    status: existing.status,
  });

  if (!isRiderPortalTrip(existing)) {
    console.error('[RiderPayment] markRiderTripPaid: not a rider trip', {
      tripId: input.tripId,
      trip_source: existing.trip_source,
      rider_id: existing.rider_id,
      organization_id: existing.organization_id,
    });
    return { updated: false, trip: null, reason: 'not_rider_trip' };
  }

  if (existing.payment_status === 'paid') {
    console.log('[RiderPayment] markRiderTripPaid: already paid', {
      tripId: input.tripId,
      status: existing.status,
    });
    return {
      updated: false,
      trip: {
        id: existing.id,
        payment_status: existing.payment_status,
        status: existing.status,
      },
      reason: 'already_paid',
    };
  }

  const fullPayload: Record<string, unknown> = {
    payment_status: 'paid',
    platform_fee_status: 'paid',
    status: 'open',
    driver_payout_status: 'pending',
    stripe_driver_payment_id: input.paymentIntentId ?? null,
    stripe_platform_payment_id: input.paymentIntentId ?? null,
    stripe_checkout_session_id: input.sessionId ?? null,
    updated_at: now,
  };

  let usedMinimalUpdate = false;
  let updateErrorMessage: string | undefined;

  const attemptUpdate = async (
    payload: Record<string, unknown>,
    label: string
  ): Promise<{ id: string; payment_status: string | null; status: string | null } | null> => {
    console.log(`[RiderPayment] markRiderTripPaid: update attempt (${label})`, {
      tripId: input.tripId,
      payload,
    });

    const { data, error } = await admin
      .from('trips')
      .update(payload)
      .eq('id', input.tripId)
      .select('id, payment_status, status')
      .maybeSingle();

    if (error) {
      updateErrorMessage = `${label}: ${error.message} (${error.code ?? 'no_code'})`;
      console.error(`[RiderPayment] markRiderTripPaid: update error (${label})`, {
        tripId: input.tripId,
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      return null;
    }

    return data;
  };

  let updated = await attemptUpdate(fullPayload, 'full');

  if (!updated) {
    usedMinimalUpdate = true;
    const minimalPayload: Record<string, unknown> = {
      payment_status: 'paid',
      status: 'open',
      updated_at: now,
    };
    if (input.sessionId) minimalPayload.stripe_checkout_session_id = input.sessionId;
    if (input.paymentIntentId) {
      minimalPayload.stripe_driver_payment_id = input.paymentIntentId;
    }
    updated = await attemptUpdate(minimalPayload, 'minimal');
  }

  if (!updated) {
    console.error('[RiderPayment] markRiderTripPaid: all update attempts failed', {
      tripId: input.tripId,
      updateError: updateErrorMessage,
    });
    return {
      updated: false,
      trip: null,
      reason: 'update_failed',
      updateError: updateErrorMessage,
      usedMinimalUpdate,
    };
  }

  const { data: verified, error: verifyError } = await admin
    .from('trips')
    .select('id, payment_status, status')
    .eq('id', input.tripId)
    .maybeSingle();

  if (verifyError) {
    console.warn('[RiderPayment] markRiderTripPaid: post-update verify read failed', {
      tripId: input.tripId,
      message: verifyError.message,
    });
  }

  const finalTrip = verified ?? updated;

  console.log('[RiderPayment] markRiderTripPaid: success', {
    tripId: input.tripId,
    updated: true,
    usedMinimalUpdate,
    trip: finalTrip,
  });

  return {
    updated: true,
    trip: finalTrip,
    usedMinimalUpdate,
  };
}

export interface VerifyCheckoutResult {
  paid: boolean;
  alreadyPaid: boolean;
  updated: boolean;
  sessionPaymentStatus: string | null;
  sessionStatus: string | null;
  paymentIntentStatus: string | null;
  trip: MarkRiderTripPaidResult['trip'];
  reason?: string;
  updateError?: string;
  stripeMode?: string;
}

/**
 * Verify a Stripe Checkout session is paid, then mark the rider trip paid.
 */
export async function verifyCheckoutSessionAndMarkRiderTripPaid(
  admin: SupabaseClient,
  stripe: Stripe,
  params: {
    tripId: string;
    riderId: string;
    sessionId: string;
  }
): Promise<VerifyCheckoutResult> {
  const stripeMode = stripeKeyMode(process.env.STRIPE_SECRET_KEY);

  console.log('[RiderPayment] verifyCheckoutSession: start', {
    tripId: params.tripId,
    sessionId: params.sessionId,
    riderId: params.riderId,
    stripeMode,
  });

  let session: Stripe.Checkout.Session;

  try {
    session = await stripe.checkout.sessions.retrieve(params.sessionId, {
      expand: ['payment_intent'],
    });
  } catch (retrieveErr: unknown) {
    const message = retrieveErr instanceof Error ? retrieveErr.message : 'Session retrieve failed';
    console.error('[RiderPayment] verifyCheckoutSession: retrieve failed', {
      tripId: params.tripId,
      sessionId: params.sessionId,
      stripeMode,
      message,
    });
    throw new Error(`Stripe session retrieve failed (${stripeMode}): ${message}`);
  }

  const paymentIntentRef = resolvePaymentIntentFromSession(session);
  const paymentIntent =
    paymentIntentRef && typeof paymentIntentRef !== 'string' ? paymentIntentRef : null;
  const paymentIntentId =
    typeof paymentIntentRef === 'string'
      ? paymentIntentRef
      : paymentIntentRef?.id ?? null;

  let paymentIntentStatus: string | null = paymentIntent?.status ?? null;

  if (!paymentIntent && paymentIntentId) {
    try {
      const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
      paymentIntentStatus = pi.status;
      if (pi.status === 'succeeded') {
        console.log('[RiderPayment] payment_intent succeeded (retrieved separately)', {
          tripId: params.tripId,
          paymentIntentId,
        });
      }
    } catch (piErr: unknown) {
      console.warn('[RiderPayment] payment_intent retrieve failed', {
        tripId: params.tripId,
        paymentIntentId,
        message: piErr instanceof Error ? piErr.message : piErr,
      });
    }
  }

  const sessionPaid = isStripeCheckoutSessionPaid(
    session,
    paymentIntent ??
      (paymentIntentStatus === 'succeeded'
        ? ({ status: 'succeeded' } as Stripe.PaymentIntent)
        : null)
  );

  console.log('[RiderPayment] verifyCheckoutSession: session state', {
    tripId: params.tripId,
    sessionId: params.sessionId,
    stripeMode,
    session_status: session.status,
    payment_status: session.payment_status,
    payment_intent_status: paymentIntentStatus,
    sessionPaid,
    metadata: session.metadata,
  });

  const metadataTripId = tripIdFromStripeMetadata(session.metadata);
  if (metadataTripId && metadataTripId !== params.tripId) {
    throw new Error(
      `Checkout session trip_id ${metadataTripId} does not match ${params.tripId}.`
    );
  }

  if (!isRiderStripePayment(session.metadata)) {
    const { data: trip } = await admin
      .from('trips')
      .select('trip_source, rider_id, organization_id')
      .eq('id', params.tripId)
      .eq('rider_id', params.riderId)
      .maybeSingle();

    if (!trip || !isRiderPortalTrip(trip)) {
      throw new Error('This checkout session is not for a rider trip.');
    }

    console.warn('[RiderPayment] session metadata missing rider markers — trusting DB trip row', {
      tripId: params.tripId,
      sessionId: params.sessionId,
    });
  }

  if (!sessionPaid) {
    return {
      paid: false,
      alreadyPaid: false,
      updated: false,
      sessionPaymentStatus: session.payment_status,
      sessionStatus: session.status ?? null,
      paymentIntentStatus,
      trip: null,
      reason: 'stripe_not_paid_yet',
      stripeMode,
    };
  }

  const result = await markRiderTripPaid(admin, {
    tripId: params.tripId,
    sessionId: session.id,
    paymentIntentId,
  });

  const paid = result.trip?.payment_status === 'paid';

  console.log('[RiderPayment] verifyCheckoutSession: complete', {
    tripId: params.tripId,
    sessionId: params.sessionId,
    paid,
    updated: result.updated,
    reason: result.reason,
    updateError: result.updateError,
    trip: result.trip,
  });

  return {
    paid,
    alreadyPaid: !result.updated && result.trip?.payment_status === 'paid',
    updated: result.updated,
    sessionPaymentStatus: session.payment_status,
    sessionStatus: session.status ?? null,
    paymentIntentStatus,
    trip: result.trip,
    reason: result.reason,
    updateError: result.updateError,
    stripeMode,
  };
}

/**
 * Fallback: find a paid Checkout Session for this trip via PaymentIntent metadata search.
 */
export async function findPaidCheckoutSessionForTrip(
  stripe: Stripe,
  tripId: string
): Promise<Stripe.Checkout.Session | null> {
  try {
    const intents = await stripe.paymentIntents.search({
      query: `metadata['trip_id']:'${tripId}' AND status:'succeeded'`,
      limit: 5,
    });

    for (const intent of intents.data) {
      if (intent.metadata?.trip_id !== tripId && intent.metadata?.tripId !== tripId) continue;

      const sessions = await stripe.checkout.sessions.list({
        payment_intent: intent.id,
        limit: 1,
      });

      const session = sessions.data[0];
      if (session && isStripeCheckoutSessionPaid(session, intent)) {
        console.log('[RiderPayment] findPaidCheckoutSessionForTrip: found via PI search', {
          tripId,
          sessionId: session.id,
          paymentIntentId: intent.id,
        });
        return session;
      }
    }
  } catch (searchErr: unknown) {
    console.warn('[RiderPayment] findPaidCheckoutSessionForTrip: search failed', {
      tripId,
      message: searchErr instanceof Error ? searchErr.message : searchErr,
    });
  }

  return null;
}