import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireAdminUser } from '@/lib/admin-auth';
import { enrichDeletedProfiles, type DeletedProfileRow } from '@/lib/driver-profile';

export const dynamic = 'force-dynamic';

async function fetchDeletedProfiles(admin: SupabaseClient): Promise<DeletedProfileRow[]> {
  const { data, error } = await admin
    .from('deleted_profiles_view')
    .select('*')
    .order('deleted_at', { ascending: false });

  if (!error) {
    return (data ?? []) as DeletedProfileRow[];
  }

  // Fallback until deleted_profiles_view.sql is applied in Supabase
  console.warn('deleted_profiles_view unavailable, using profiles + auth enrichment:', error.message);

  const { data: profiles, error: profilesError } = await admin
    .from('profiles')
    .select(
      'id, full_name, first_name, last_name, email, role, organization_name, deleted_at, deleted_by, created_at'
    )
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false });

  if (profilesError) {
    throw new Error(profilesError.message);
  }

  return enrichDeletedProfiles(admin, (profiles ?? []) as DeletedProfileRow[]);
}

export async function GET() {
  const auth = await requireAdminUser();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const admin = auth.admin;

  try {
    const [deletedProfiles, tripsResult, auditResult] = await Promise.all([
      fetchDeletedProfiles(admin),
      admin
        .from('trips')
        .select(
          'id, title, status, pickup_location, dropoff_location, organization_id, rider_id, deleted_at, deleted_by, created_at'
        )
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false }),
      admin
        .from('soft_delete_audit_log')
        .select('*')
        .order('performed_at', { ascending: false })
        .limit(100),
    ]);

    if (tripsResult.error) {
      return NextResponse.json({ error: tripsResult.error.message }, { status: 500 });
    }

    return NextResponse.json({
      profiles: deletedProfiles,
      trips: tripsResult.data ?? [],
      auditLog: auditResult.data ?? [],
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load deleted profiles';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}