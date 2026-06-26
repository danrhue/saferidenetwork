import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { fetchBrowseTripsForDriver } from '@/lib/driver/open-trips';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await fetchBrowseTripsForDriver(supabase, user.id, user.email);

    if (result.blocked) {
      return NextResponse.json(result, { status: 403 });
    }

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}