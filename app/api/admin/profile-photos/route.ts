import { NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/admin-auth';
import { listDriverProfilePhotos } from '@/lib/admin/profile-photo-review';
import { getErrorMessage } from '@/lib/errors';

export const dynamic = 'force-dynamic';

const VALID_STATUSES = new Set(['pending', 'approved', 'rejected', 'all']);

export async function GET(request: Request) {
  const auth = await requireAdminUser();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const status = (searchParams.get('status') ?? 'pending') as
    | 'pending'
    | 'approved'
    | 'rejected'
    | 'all';

  if (!VALID_STATUSES.has(status)) {
    return NextResponse.json({ error: 'Invalid status filter' }, { status: 400 });
  }

  try {
    const drivers = await listDriverProfilePhotos(auth.admin, {
      status,
      from: searchParams.get('from'),
      to: searchParams.get('to'),
    });
    return NextResponse.json(drivers, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    const message = getErrorMessage(error);
    console.error('[api/admin/profile-photos] List failed:', message, error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}