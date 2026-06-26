import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getRequiredDocument } from '@/lib/driver/required-documents';
import { dateInputToExpiresAt } from '@/lib/driver/document-dates';
import { EXPIRED_DOCUMENT_REJECTION_REASON } from '@/lib/driver/document-expiration';
import { syncPairedDriversLicenseExpiry } from '@/lib/driver/sync-drivers-license-expiry';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const documentType =
      typeof body.documentType === 'string' ? body.documentType.trim() : '';
    const expiresAt =
      typeof body.expiresAt === 'string' ? body.expiresAt.trim() : '';

    if (!documentType || !expiresAt) {
      return NextResponse.json(
        { error: 'Document type and expiration date are required.' },
        { status: 400 }
      );
    }

    const docDef = getRequiredDocument(documentType);
    if (!docDef) {
      return NextResponse.json({ error: 'Unknown document type.' }, { status: 400 });
    }

    if (!docDef.requiresExpiration && !docDef.validityYears) {
      return NextResponse.json(
        { error: 'This document type does not use an expiration date.' },
        { status: 400 }
      );
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(expiresAt)) {
      return NextResponse.json(
        { error: 'Expiration date must be YYYY-MM-DD.' },
        { status: 400 }
      );
    }

    const expiryEnd = new Date(dateInputToExpiresAt(expiresAt));
    if (expiryEnd.getTime() <= Date.now()) {
      return NextResponse.json(
        { error: 'Expiration date must be in the future.' },
        { status: 400 }
      );
    }

    const { data: existing, error: fetchError } = await supabase
      .from('driver_documents')
      .select('id, status, rejection_reason')
      .eq('driver_id', user.id)
      .eq('document_type', documentType)
      .maybeSingle();

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!existing) {
      return NextResponse.json(
        { error: 'Upload this document first, then save the expiration date.' },
        { status: 404 }
      );
    }

    const wasExpiredRejection =
      existing.status === 'rejected' &&
      existing.rejection_reason === EXPIRED_DOCUMENT_REJECTION_REASON;

    const updatePayload: {
      expires_at: string;
      status?: string;
      rejection_reason?: string | null;
    } = {
      expires_at: dateInputToExpiresAt(expiresAt),
    };

    if (wasExpiredRejection) {
      updatePayload.status = 'pending_review';
      updatePayload.rejection_reason = null;
    }

    const { error: updateError } = await supabase
      .from('driver_documents')
      .update(updatePayload)
      .eq('id', existing.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    await syncPairedDriversLicenseExpiry(
      supabase,
      user.id,
      documentType,
      dateInputToExpiresAt(expiresAt)
    );

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}