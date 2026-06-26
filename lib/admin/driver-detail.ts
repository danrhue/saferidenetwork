import type { SupabaseClient } from '@supabase/supabase-js';
import { withSignedDocumentUrls } from '@/lib/driver-document-urls';
import { enrichDriverProfiles, type DriverProfileRow } from '@/lib/driver-profile';
import { autoRejectExpiredDocuments } from '@/lib/driver/document-expiration';
import {
  fetchAssignedTripsForDriver,
  type AdminDriverAssignedTrip,
} from '@/lib/admin/driver-assigned-trips';
import {
  buildAdminDriverOnboardingStatus,
  loadRequiredDocumentsForDriver,
  type AdminDriverOnboardingStatus,
} from '@/lib/admin/driver-onboarding-status';
import { fetchProfilePhotoAuditHistory } from '@/lib/admin/profile-photo-review';
import { resolveProfilePhotoUrl } from '@/lib/storage/profile-photos';

export type { AdminDriverAssignedTrip, AdminDriverOnboardingStatus };

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
  assignedTrips: AdminDriverAssignedTrip[];
  onboardingStatus: AdminDriverOnboardingStatus;
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

  const requiredDocuments = await loadRequiredDocumentsForDriver(
    admin,
    enriched.driving_states as string[] | null | undefined
  );

  const [signedDocuments, photoAudit, assignedTrips] = await Promise.all([
    withSignedDocumentUrls(admin, documents ?? []),
    fetchProfilePhotoAuditHistory(admin, driverId),
    fetchAssignedTripsForDriver(admin, driverId),
  ]);

  const onboardingStatus = buildAdminDriverOnboardingStatus(
    {
      ...enriched,
      mailing_same_as_physical: enriched.mailing_same_as_physical !== false,
    },
    documents ?? [],
    requiredDocuments
  );

  return {
    driver: {
      ...enriched,
      photo_url,
    },
    documents: signedDocuments,
    photoAudit,
    assignedTrips,
    onboardingStatus,
  };
}