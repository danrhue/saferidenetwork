import type { SupabaseClient } from '@supabase/supabase-js';
import {
  DRIVERS_LICENSE_BACK,
  DRIVERS_LICENSE_FRONT,
  getPairedDriversLicenseType,
} from '@/lib/driver/drivers-license-documents';

/**
 * Keep the paired license upload's expiration in sync when the front is updated.
 * The back card has no expiration field — both sides share the same license date.
 */
export async function syncPairedDriversLicenseExpiry(
  supabase: SupabaseClient,
  driverId: string,
  documentType: string,
  expiresAt: string | null
): Promise<void> {
  if (documentType !== DRIVERS_LICENSE_FRONT || !expiresAt) return;

  const pairedType = getPairedDriversLicenseType(documentType);
  if (!pairedType || pairedType !== DRIVERS_LICENSE_BACK) return;

  const { data: paired } = await supabase
    .from('driver_documents')
    .select('id')
    .eq('driver_id', driverId)
    .eq('document_type', pairedType)
    .maybeSingle();

  if (!paired) return;

  await supabase
    .from('driver_documents')
    .update({ expires_at: expiresAt })
    .eq('id', paired.id);
}