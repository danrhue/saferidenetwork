import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { createDriverExpressAccount } from '@/lib/stripe';

/**
 * POST /api/stripe/connect/create-account
 * Creates (or returns existing) Stripe Express connected account for a driver.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { user } = auth;
    const admin = getSupabaseAdmin();

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('role, stripe_account_id, full_name')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    if (profile.role !== 'driver') {
      return NextResponse.json(
        { error: 'Only drivers can connect a Stripe account' },
        { status: 403 }
      );
    }

    // Return existing connected account if already created
    if (profile.stripe_account_id) {
      return NextResponse.json({
        accountId: profile.stripe_account_id,
        existing: true,
      });
    }

    const account = await createDriverExpressAccount(
      user.email || `${user.id}@saferidenetwork.com`,
      user.id
    );

    const { error: updateError } = await admin
      .from('profiles')
      .update({
        stripe_account_id: account.id,
        stripe_onboarding_complete: false,
        stripe_charges_enabled: false,
        stripe_payouts_enabled: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Failed to save stripe_account_id:', updateError);
      return NextResponse.json({ error: 'Failed to save account' }, { status: 500 });
    }

    return NextResponse.json({
      accountId: account.id,
      existing: false,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('create-account error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}