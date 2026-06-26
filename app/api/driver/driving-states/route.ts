import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import {
  fetchDrivingStatesForUser,
  saveDrivingStatesForUser,
} from '@/lib/driver/driving-states-server';

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

    const admin = getSupabaseAdmin();
    const drivingStates = await fetchDrivingStatesForUser(admin, user.id);

    return NextResponse.json({ drivingStates });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load operating states.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const rawStates = Array.isArray(body.drivingStates) ? body.drivingStates : [];

    const admin = getSupabaseAdmin();
    const result = await saveDrivingStatesForUser(admin, user, rawStates as string[]);

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to save operating states.';
    const status =
      message.includes('Select at least one') || message.includes('Only driver')
        ? 400
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}