import { NextRequest, NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/admin-auth';
import { withSignedDocumentUrls } from '@/lib/driver-document-urls';
import { enrichDriverProfiles } from '@/lib/driver-profile';
import { autoRejectExpiredDocuments } from '@/lib/driver/document-expiration';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requireAdminUser();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const driverId = request.nextUrl.searchParams.get('driverId');
  if (!driverId) {
    return NextResponse.json({ error: 'driverId is required' }, { status: 400 });
  }

  await autoRejectExpiredDocuments(auth.admin, driverId);

  const [{ data: profile, error: profileError }, { data: documents, error: docsError }] =
    await Promise.all([
      auth.admin
        .from('profiles')
        .select('id, full_name, role, phone, created_at')
        .eq('id', driverId)
        .single(),
      auth.admin
        .from('driver_documents')
        .select(
          'id, driver_id, document_type, file_url, file_name, file_path, uploaded_at, expires_at, status, rejection_reason'
        )
        .eq('driver_id', driverId)
        .order('uploaded_at', { ascending: false }),
    ]);

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  if (docsError) {
    return NextResponse.json({ error: docsError.message }, { status: 500 });
  }

  const [driver] = await enrichDriverProfiles(auth.admin, [profile]);
  const signedDocuments = await withSignedDocumentUrls(auth.admin, documents ?? []);

  return NextResponse.json({
    driver,
    documents: signedDocuments,
  });
}