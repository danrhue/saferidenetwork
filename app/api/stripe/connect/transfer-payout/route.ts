import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { transferDriverPayout, dollarsToCents } from '@/lib/stripe';

/**
 * POST /api/stripe/connect/transfer-payout
 * Transfers held driver compensation to the assigned driver's Express account.
 * Called when an organization marks a trip as completed.
 */
export async function POST(request: NextRequest) {
  let tripId: string | undefined;

  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    tripId = body.tripId;
    if (!tripId) {
      return NextResponse.json({ error: 'tripId is required' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    const { data: trip, error: tripError } = await admin
      .from('trips')
      .select(
        'id, organization_id, assigned_driver_id, payment_status, driver_payout_status, final_price, price, stripe_driver_payment_id'
      )
      .eq('id', tripId)
      .single();

    if (tripError || !trip) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }

    if (trip.organization_id !== auth.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!trip.assigned_driver_id) {
      return NextResponse.json({ error: 'No driver assigned to this trip' }, { status: 400 });
    }

    if (trip.payment_status !== 'paid') {
      return NextResponse.json(
        { error: 'Driver compensation has not been paid yet' },
        { status: 400 }
      );
    }

    if (trip.driver_payout_status === 'transferred') {
      return NextResponse.json({ success: true, alreadyTransferred: true });
    }

    if (!trip.stripe_driver_payment_id) {
      return NextResponse.json(
        { error: 'No payment record found for this trip' },
        { status: 400 }
      );
    }

    const { data: driverProfile, error: driverError } = await admin
      .from('profiles')
      .select('stripe_account_id, stripe_payouts_enabled, full_name')
      .eq('id', trip.assigned_driver_id)
      .single();

    if (driverError || !driverProfile?.stripe_account_id) {
      return NextResponse.json(
        {
          error:
            'Assigned driver has not connected their Stripe account. They must complete Stripe onboarding before payout.',
        },
        { status: 400 }
      );
    }

    const payoutAmount = trip.final_price ?? trip.price ?? 0;
    if (payoutAmount <= 0) {
      return NextResponse.json({ error: 'Invalid payout amount' }, { status: 400 });
    }

    const transfer = await transferDriverPayout({
      amountCents: dollarsToCents(payoutAmount),
      driverStripeAccountId: driverProfile.stripe_account_id,
      tripId: trip.id,
      sourcePaymentIntentId: trip.stripe_driver_payment_id,
    });

    await admin
      .from('trips')
      .update({
        driver_payout_status: 'transferred',
        stripe_transfer_id: transfer.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', tripId);

    return NextResponse.json({
      success: true,
      transferId: transfer.id,
      amount: payoutAmount,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('transfer-payout error:', message);

    if (tripId) {
      const admin = getSupabaseAdmin();
      await admin
        .from('trips')
        .update({ driver_payout_status: 'failed', updated_at: new Date().toISOString() })
        .eq('id', tripId);
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}