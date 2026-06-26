import { NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/admin-auth';
import { getProfilePhotoPublicUrl } from '@/lib/storage/profile-photos';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireAdminUser();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { data, error } = await auth.admin
    .from('profiles')
    .select(
      'id, full_name, phone, email, profile_photo_url, profile_photo_status, updated_at'
    )
    .eq('role', 'driver')
    .eq('profile_photo_status', 'pending')
    .not('profile_photo_url', 'is', null)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Pending profile photos fetch error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const drivers = (data ?? []).map((row) => ({
    ...row,
    photo_url: getProfilePhotoPublicUrl(row.profile_photo_url),
  }));

  return NextResponse.json(drivers);
}