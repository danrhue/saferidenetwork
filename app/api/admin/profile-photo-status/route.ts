import { NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/admin-auth';
import { reviewDriverProfilePhotos } from '@/lib/admin/profile-photo-review';
import { getErrorMessage } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const auth = await requireAdminUser();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const { profileId, profileIds, status, reason } = body;

  if (!['approved', 'rejected'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const ids: string[] = Array.isArray(profileIds)
    ? profileIds
    : profileId
      ? [profileId]
      : [];

  let result;
  try {
    result = await reviewDriverProfilePhotos(
      auth.admin,
      auth.user.id,
      ids,
      status,
      typeof reason === 'string' ? reason : undefined
    );
  } catch (error) {
    const message = getErrorMessage(error);
    console.error('[api/admin/profile-photo-status] Review failed:', message, error);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  if (result.succeeded.length === 0 && result.failed.length > 0) {
    return NextResponse.json(
      {
        error: result.failed[0]?.error ?? 'Review failed',
        failed: result.failed,
      },
      { status: 400 }
    );
  }

  return NextResponse.json({
    success: true,
    succeeded: result.succeeded,
    failed: result.failed,
  });
}