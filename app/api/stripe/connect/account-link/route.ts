import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { createDriverAccountLink } from '@/lib/stripe';

/**
 * POST /api/stripe/connect/account-link
 * Generates a Stripe Express onboarding link for the authenticated driver.
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
      .select('role, stripe_account_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    if (profile.role !== 'driver') {
      return NextResponse.json(
        { error: 'Only drivers can access Stripe onboarding' },
        { status: 403 }
      );
    }

    if (!profile.stripe_account_id) {
      return NextResponse.json(
        { error: 'No Stripe account found. Create one first.' },
        { status: 400 }
      );
    }

    let returnPath = '/dashboard/payments';
    try {
      const body = await request.json();
      if (
        typeof body?.returnPath === 'string' &&
        body.returnPath.startsWith('/dashboard/') &&
        !body.returnPath.includes('..')
      ) {
        returnPath = body.returnPath;
      }
    } catch {
      // Empty body — use default return path.
    }

    const accountLink = await createDriverAccountLink(profile.stripe_account_id, returnPath);

    return NextResponse.json({ url: accountLink.url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('account-link error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}