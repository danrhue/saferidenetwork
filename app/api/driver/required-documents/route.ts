import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { resolveRequiredDocumentsForStates } from '@/lib/driver/resolve-driver-documents';
import type { StateRequirementRow } from '@/lib/driver/resolve-driver-documents';
import { normalizeStateCodes } from '@/lib/driver/us-states';

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

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('driving_states, role')
      .eq('id', user.id)
      .single();

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    const drivingStates = normalizeStateCodes(profile?.driving_states);

    if (drivingStates.length === 0) {
      return NextResponse.json({
        drivingStates: [],
        documents: [],
        message: 'Select at least one operating state to see required documents.',
      });
    }

    const admin = getSupabaseAdmin();
    const { data: rows, error: reqError } = await admin
      .from('state_document_requirements')
      .select('state_code, document_type, sort_order, is_required, description')
      .in('state_code', drivingStates)
      .eq('is_required', true)
      .order('sort_order', { ascending: true });

    if (reqError) {
      return NextResponse.json({ error: reqError.message }, { status: 500 });
    }

    const documents = resolveRequiredDocumentsForStates(
      drivingStates,
      (rows ?? []) as StateRequirementRow[]
    );

    return NextResponse.json({
      drivingStates,
      documents,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}