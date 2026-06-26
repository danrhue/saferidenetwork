import { SupabaseClient } from '@supabase/supabase-js';

type DriverDocumentRow = {
  id: string;
  driver_id?: string;
  document_type: string;
  file_url: string;
  file_name: string;
  file_path?: string | null;
  uploaded_at: string;
  expires_at?: string | null;
  status: string;
};

export async function withSignedDocumentUrls<T extends DriverDocumentRow>(
  admin: SupabaseClient,
  documents: T[]
): Promise<T[]> {
  return Promise.all(
    documents.map(async (doc) => {
      if (!doc.file_path) return doc;

      const { data, error } = await admin.storage
        .from('driver-documents')
        .createSignedUrl(doc.file_path, 3600);

      if (error || !data?.signedUrl) return doc;

      return { ...doc, file_url: data.signedUrl };
    })
  );
}