import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { fetchDriverPaymentsDashboard } from '@/lib/driver/driver-earnings';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const page = Number(searchParams.get('page') ?? '1');

    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_account_id, stripe_payouts_enabled')
      .eq('id', user.id)
      .single();

    const result = await fetchDriverPaymentsDashboard(supabase, user.id, {
      from,
      to,
      page: Number.isFinite(page) ? page : 1,
      stripeAccountId: profile?.stripe_account_id ?? null,
      stripePayoutsEnabled: profile?.stripe_payouts_enabled ?? false,
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}