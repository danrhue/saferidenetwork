import { NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/admin-auth';
import { applyDeletedFilter } from '@/lib/soft-delete';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await requireAdminUser();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const showDeleted = searchParams.get('showDeleted') === 'true';

  let query = auth.admin
    .from('profiles')
    .select('id, full_name, organization_name, email, phone, role, created_at, deleted_at, deleted_by')
    .eq('role', 'organization')
    .order('created_at', { ascending: false });

  query = applyDeletedFilter(query, showDeleted);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}