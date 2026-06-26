'use server';

import { createClient } from '@/utils/supabase/server';
import { documentRequiresExpiration } from '@/lib/driver/required-documents';
import { EXPIRED_DOCUMENT_REJECTION_REASON } from '@/lib/driver/document-expiration';
import { dateInputToExpiresAt } from '@/lib/driver/document-dates';

export async function uploadDriverDocument(formData: FormData) {
  try {
    const supabase = await createClient();
    const file = formData.get('file') as File;
    const documentType = formData.get('documentType') as string;
    const expiresAtRaw = formData.get('expiresAt');
    const expiresAt =
      typeof expiresAtRaw === 'string' && expiresAtRaw.trim().length > 0
        ? expiresAtRaw.trim()
        : null;

    if (!file || !documentType) {
      throw new Error('File and document type are required');
    }

    if (documentRequiresExpiration(documentType) && !expiresAt) {
      throw new Error('Expiration date is required for this document');
    }

    if (expiresAt) {
      const expiryEnd = new Date(dateInputToExpiresAt(expiresAt));
      if (expiryEnd.getTime() <= Date.now()) {
        throw new Error('Expiration date must be in the future');
      }
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('You must be logged in to upload documents');

    const fileExt = file.name.split('.').pop() || 'pdf';
    const timestamp = Date.now();
    const filePath = `${user.id}/${documentType}/${timestamp}.${fileExt}`;

    const { error: storageError } = await supabase.storage
      .from('driver-documents')
      .upload(filePath, file, {
        upsert: true,
        contentType: file.type || 'application/octet-stream',
        cacheControl: '3600',
      });

    if (storageError) {
      console.error('Storage error:', storageError);
      throw new Error(`Storage upload failed: ${storageError.message}`);
    }

    const { data: { publicUrl } } = supabase.storage
      .from('driver-documents')
      .getPublicUrl(filePath);

    const { error: dbError } = await supabase
      .from('driver_documents')
      .upsert(
        {
          driver_id: user.id,
          document_type: documentType,
          file_url: publicUrl,
          file_name: file.name,
          file_path: filePath,
          uploaded_at: new Date().toISOString(),
          expires_at: expiresAt ? dateInputToExpiresAt(expiresAt) : null,
          status: 'pending_review',
          rejection_reason: null,
        },
        { onConflict: 'driver_id,document_type' }
      );

    if (dbError) {
      console.error('Database error:', dbError);
      throw new Error(`Database error: ${dbError.message}`);
    }

    if (expiresAt) {
      const expiryDate = new Date(dateInputToExpiresAt(expiresAt));
      if (expiryDate.getTime() < Date.now()) {
        await supabase
          .from('driver_documents')
          .update({
            status: 'rejected',
            rejection_reason: EXPIRED_DOCUMENT_REJECTION_REASON,
          })
          .eq('driver_id', user.id)
          .eq('document_type', documentType);
      }
    }

    return { success: true };
  } catch (error: unknown) {
    console.error('Full upload error:', error);
    const message = error instanceof Error ? error.message : 'Upload failed. Check console.';
    throw new Error(message);
  }
}