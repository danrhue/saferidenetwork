import type { SupabaseClient } from '@supabase/supabase-js';

export const EXPIRED_DOCUMENT_REJECTION_REASON =
  'Document has expired. Please upload an updated version with a valid expiration date.';

export function isDocumentExpired(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() < Date.now();
}

/**
 * Marks expired driver documents as rejected (service-role client recommended).
 */
export async function autoRejectExpiredDocuments(
  admin: SupabaseClient,
  driverId?: string
): Promise<number> {
  const now = new Date().toISOString();

  let query = admin
    .from('driver_documents')
    .select('id')
    .not('expires_at', 'is', null)
    .lt('expires_at', now)
    .in('status', ['uploaded', 'pending_review', 'approved']);

  if (driverId) {
    query = query.eq('driver_id', driverId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('autoRejectExpiredDocuments query error:', error);
    return 0;
  }

  if (!data?.length) {
    return 0;
  }

  const { error: updateError } = await admin
    .from('driver_documents')
    .update({
      status: 'rejected',
      rejection_reason: EXPIRED_DOCUMENT_REJECTION_REASON,
    })
    .in(
      'id',
      data.map((row) => row.id)
    );

  if (updateError) {
    console.error('autoRejectExpiredDocuments update error:', updateError);
    return 0;
  }

  return data.length;
}