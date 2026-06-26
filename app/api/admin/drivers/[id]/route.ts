import { NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/admin-auth';
import { getAdminDriverDetail } from '@/lib/admin/driver-detail';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireAdminUser();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: 'Driver id is required' }, { status: 400 });
  }

  try {
    const detail = await getAdminDriverDetail(auth.admin, id);
    if (!detail) {
      return NextResponse.json({ error: 'Driver not found' }, { status: 404 });
    }

    return NextResponse.json(detail);
  } catch (error) {
    console.error('Admin driver detail error:', error);
    const message = error instanceof Error ? error.message : 'Failed to load driver';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}