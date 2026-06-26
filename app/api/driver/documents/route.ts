import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { withSignedDocumentUrls } from '@/lib/driver-document-urls';
import { autoRejectExpiredDocuments } from '@/lib/driver/document-expiration';

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
    await autoRejectExpiredDocuments(admin, user.id);

    const { data, error } = await supabase
      .from('driver_documents')
      .select('id, document_type, file_url, file_name, file_path, uploaded_at, expires_at, status, rejection_reason')
      .eq('driver_id', user.id)
      .order('uploaded_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const documents = await withSignedDocumentUrls(admin, data ?? []);
    return NextResponse.json(documents);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}