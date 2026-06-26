import type { SupabaseClient } from '@supabase/supabase-js';
import { withSignedDocumentUrls } from '@/lib/driver-document-urls';
import { enrichDriverProfiles, type DriverProfileRow } from '@/lib/driver-profile';
import { autoRejectExpiredDocuments } from '@/lib/driver/document-expiration';
import { fetchProfilePhotoAuditHistory } from '@/lib/admin/profile-photo-review';
import { resolveProfilePhotoUrl } from '@/lib/storage/profile-photos';

export type AdminDriverDocument = {
  id: string;
  document_type: string;
  file_url: string;
  file_name: string;
  uploaded_at: string;
  expires_at?: string | null;
  status: string;
  rejection_reason?: string | null;
};

export type AdminDriverDetail = {
  driver: DriverProfileRow & {
    photo_url: string | null;
    profile_photo_url?: string | null;
    profile_photo_status?: string | null;
    profile_photo_rejection_reason?: string | null;
    profile_photo_last_reviewed_at?: string | null;
    driving_states?: string[] | null;
  };
  documents: AdminDriverDocument[];
  photoAudit: Awaited<ReturnType<typeof fetchProfilePhotoAuditHistory>>;
};

export async function getAdminDriverDetail(
  admin: SupabaseClient,
  driverId: string
): Promise<AdminDriverDetail | null> {
  await autoRejectExpiredDocuments(admin, driverId);

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('*')
    .eq('id', driverId)
    .eq('role', 'driver')
    .maybeSingle();

  if (profileError || !profile) {
    return null;
  }

  const [enriched] = await enrichDriverProfiles(admin, [profile as DriverProfileRow]);
  const photo_url = await resolveProfilePhotoUrl(admin, enriched.profile_photo_url as string | null);

  const { data: documents, error: docsError } = await admin
    .from('driver_documents')
    .select(
      'id, document_type, file_url, file_name, file_path, uploaded_at, expires_at, status, rejection_reason'
    )
    .eq('driver_id', driverId)
    .order('uploaded_at', { ascending: false });

  if (docsError) {
    throw new Error(docsError.message);
  }

  const signedDocuments = await withSignedDocumentUrls(admin, documents ?? []);
  const photoAudit = await fetchProfilePhotoAuditHistory(admin, driverId);

  return {
    driver: {
      ...enriched,
      photo_url,
    },
    documents: signedDocuments,
    photoAudit,
  };
}