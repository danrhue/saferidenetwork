import { NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/admin-auth';
import { listDriverProfilePhotos } from '@/lib/admin/profile-photo-review';

export const dynamic = 'force-dynamic';

/** @deprecated Use GET /api/admin/profile-photos?status=pending */
export async function GET() {
  const auth = await requireAdminUser();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const drivers = await listDriverProfilePhotos(auth.admin, { status: 'pending' });
    return NextResponse.json(drivers);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load pending profile photos';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}