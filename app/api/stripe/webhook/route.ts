import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getStripe, getConnectAccountStatus } from '@/lib/stripe';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import {
  chargeTypeFromStripeMetadata,
  isRiderStripePayment,
  isStripeCheckoutSessionPaid,
  markRiderTripPaid,
  resolvePaymentIntentFromSession,
  tripIdFromStripeMetadata,
  tripSourceFromStripeMetadata,
} from '@/lib/rider/stripe-payment';

export const runtime = 'nodejs';

/**
 * POST /api/stripe/webhook
 *
 * Handles Stripe platform + Connect webhook events (service role updates).
 * Configure in Stripe Dashboard → Developers → Webhooks →
 *   https://www.saferidenetwork.com/api/stripe/webhook
 *
 * Required events for rider payments:
 * - checkout.session.completed
 * - payment_intent.succeeded (backup)
 */
export async function POST(request: NextRequest) {
  const stripe = getStripe();
  const supabase = getSupabaseAdmin();

  const sig = request.headers.get('stripe-signature');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    console.error('[Stripe] Webhook missing signature or STRIPE_WEBHOOK_SECRET');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 400 });
  }

  const body = await request.text();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Invalid signature';
    console.error('[Stripe] Webhook signature verification failed:', message);
    return NextResponse.json({ error: `Webhook Error: ${message}` }, { status: 400 });
  }

  console.log(`[Stripe] Webhook received: ${event.type} (${event.id})`);

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session, supabase);
        break;

      case 'checkout.session.async_payment_succeeded':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session, supabase);
        break;

      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent, supabase);
        break;

      case 'account.updated':
        await handleAccountUpdated(event.data.object as Stripe.Account, supabase);
        break;

      case 'transfer.created':
        await handleTransferCreated(event.data.object as Stripe.Transfer, supabase);
        break;

      case 'payout.paid':
        console.log(
          `[Connect] Payout paid: ${(event.data.object as Stripe.Payout).id} → account ${(event.data.object as Stripe.Payout).destination}`
        );
        break;

      case 'payment_intent.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.PaymentIntent, supabase);
        break;

      default:
        console.log(`[Stripe] Unhandled event type: ${event.type}`);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Webhook handler error';
    console.error(`[Stripe] Webhook handler failed for ${event.type}:`, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

// ---------------------------------------------------------------------------
// checkout.session.completed
// ---------------------------------------------------------------------------

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
  supabase: ReturnType<typeof getSupabaseAdmin>
) {
  const metadata = session.metadata;
  const tripId = tripIdFromStripeMetadata(metadata);
  const tripSource = tripSourceFromStripeMetadata(metadata);
  const chargeType = chargeTypeFromStripeMetadata(metadata) ?? 'driver_compensation';

  console.log('[Stripe] checkout.session.completed', {
    sessionId: session.id,
    paymentStatus: session.payment_status,
    tripId,
    tripSource,
    chargeType,
    metadata,
  });

  if (!tripId) {
    console.warn('[Stripe] checkout.session.completed without trip_id metadata');
    return;
  }

  const paymentIntentRef = resolvePaymentIntentFromSession(session);
  const paymentIntentId =
    typeof paymentIntentRef === 'string' ? paymentIntentRef : paymentIntentRef?.id ?? null;
  const paymentIntentObj =
    paymentIntentRef && typeof paymentIntentRef !== 'string' ? paymentIntentRef : null;

  const isRiderCheckout = tripSource === 'rider' || isRiderStripePayment(metadata);
  const sessionPaid = isStripeCheckoutSessionPaid(session, paymentIntentObj);

  // Rider: lenient paid check (sandbox). Org: strict payment_status gate.
  if (!isRiderCheckout && session.payment_status && session.payment_status !== 'paid') {
    console.log(
      `[Stripe] Session ${session.id} payment_status=${session.payment_status} — skipping org trip update`
    );
    return;
  }

  if (isRiderCheckout && !sessionPaid) {
    console.log('[Stripe] Rider session not paid yet — deferring', {
      tripId,
      sessionId: session.id,
      payment_status: session.payment_status,
      session_status: session.status,
    });
    return;
  }

  // -------------------------------------------------------------------------
  // Rider Portal
  // -------------------------------------------------------------------------
  if (isRiderCheckout) {
    console.log('[Stripe] rider checkout.session.completed — marking trip paid', {
      tripId,
      sessionId: session.id,
      paymentStatus: session.payment_status,
      sessionStatus: session.status,
      paymentIntentId: paymentIntentId ?? null,
    });
    const riderResult = await markRiderTripPaid(supabase, {
      tripId,
      sessionId: session.id,
      paymentIntentId: paymentIntentId ?? null,
    });
    console.log('[Stripe] rider payment update result', {
      tripId,
      sessionId: session.id,
      updated: riderResult.updated,
      reason: riderResult.reason,
      updateError: riderResult.updateError,
      trip: riderResult.trip,
    });
    if (!riderResult.updated && riderResult.trip?.payment_status !== 'paid') {
      throw new Error(
        riderResult.updateError ?? riderResult.reason ?? 'Rider trip payment update failed'
      );
    }
    return;
  }

  const now = new Date().toISOString();

  // -------------------------------------------------------------------------
  // Organization — platform fee only
  // -------------------------------------------------------------------------
  if (chargeType === 'platform_fee') {
    const { error } = await supabase
      .from('trips')
      .update({
        platform_fee_status: 'paid',
        stripe_platform_payment_id: paymentIntentId ?? null,
        updated_at: now,
      })
      .eq('id', tripId);

    if (error) {
      console.error(`[Stripe] Failed to update platform fee for trip ${tripId}:`, error);
      throw error;
    }

    console.log(`[Stripe] Platform fee paid for trip ${tripId}`);
    return;
  }

  // -------------------------------------------------------------------------
  // Organization — destination payout
  // -------------------------------------------------------------------------
  if (chargeType === 'destination_payout') {
    const { error } = await supabase
      .from('trips')
      .update({
        payment_status: 'paid',
        platform_fee_status: 'paid',
        driver_payout_status: 'transferred',
        stripe_driver_payment_id: paymentIntentId ?? null,
        stripe_platform_payment_id: paymentIntentId ?? null,
        updated_at: now,
      })
      .eq('id', tripId);

    if (error) {
      console.error(`[Stripe] Failed destination payout update for trip ${tripId}:`, error);
      throw error;
    }

    console.log(`[Stripe] Destination payout completed for trip ${tripId}`);
    return;
  }

  // -------------------------------------------------------------------------
  // Organization — driver compensation held until completion
  // -------------------------------------------------------------------------
  const { error } = await supabase
    .from('trips')
    .update({
      payment_status: 'paid',
      driver_payout_status: 'pending',
      stripe_driver_payment_id: paymentIntentId ?? null,
      stripe_checkout_session_id: session.id,
      updated_at: now,
    })
    .eq('id', tripId);

  if (error) {
    console.error(`[Stripe] Failed driver compensation update for trip ${tripId}:`, error);
    throw error;
  }

  console.log(`[Stripe] Driver compensation held for trip ${tripId}`);
}

// ---------------------------------------------------------------------------
// payment_intent.succeeded — backup path for rider payments
// ---------------------------------------------------------------------------

async function handlePaymentIntentSucceeded(
  paymentIntent: Stripe.PaymentIntent,
  supabase: ReturnType<typeof getSupabaseAdmin>
) {
  const metadata = paymentIntent.metadata;
  const tripId = tripIdFromStripeMetadata(metadata);

  if (!tripId || !isRiderStripePayment(metadata)) {
    return;
  }

  console.log('[Stripe] payment_intent.succeeded (rider)', {
    paymentIntentId: paymentIntent.id,
    tripId,
    metadata,
  });

  const piResult = await markRiderTripPaid(supabase, {
    tripId,
    paymentIntentId: paymentIntent.id,
  });
  console.log('[Stripe] payment_intent.succeeded (rider) update result', {
    tripId,
    paymentIntentId: paymentIntent.id,
    updated: piResult.updated,
    reason: piResult.reason,
    trip: piResult.trip,
  });
}

// ---------------------------------------------------------------------------
// Other handlers
// ---------------------------------------------------------------------------

async function handleAccountUpdated(
  account: Stripe.Account,
  supabase: ReturnType<typeof getSupabaseAdmin>
) {
  const userId = account.metadata?.supabase_user_id;
  if (!userId) return;

  const status = getConnectAccountStatus(account);

  await supabase
    .from('profiles')
    .update({
      stripe_onboarding_complete: status.onboardingComplete,
      stripe_charges_enabled: status.chargesEnabled,
      stripe_payouts_enabled: status.payoutsEnabled,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  console.log(
    `[Connect] Account ${account.id} updated for user ${userId}: payouts=${status.payoutsEnabled}`
  );
}

async function handleTransferCreated(
  transfer: Stripe.Transfer,
  supabase: ReturnType<typeof getSupabaseAdmin>
) {
  const tripId = tripIdFromStripeMetadata(transfer.metadata);
  if (!tripId) return;

  await supabase
    .from('trips')
    .update({
      driver_payout_status: 'transferred',
      stripe_transfer_id: transfer.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', tripId);

  console.log(`[Connect] Transfer ${transfer.id} created for trip ${tripId}`);
}

async function handlePaymentFailed(
  paymentIntent: Stripe.PaymentIntent,
  supabase: ReturnType<typeof getSupabaseAdmin>
) {
  const tripId = tripIdFromStripeMetadata(paymentIntent.metadata);
  const chargeType = chargeTypeFromStripeMetadata(paymentIntent.metadata);

  if (!tripId) return;

  if (chargeType === 'platform_fee') {
    await supabase
      .from('trips')
      .update({ platform_fee_status: 'failed', updated_at: new Date().toISOString() })
      .eq('id', tripId);
  } else if (isRiderStripePayment(paymentIntent.metadata)) {
    await supabase
      .from('trips')
      .update({
        payment_status: 'failed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', tripId);
  } else {
    await supabase
      .from('trips')
      .update({ payment_status: 'failed', updated_at: new Date().toISOString() })
      .eq('id', tripId);
  }

  console.warn(`[Stripe] Payment failed for trip ${tripId} (${chargeType})`);
}