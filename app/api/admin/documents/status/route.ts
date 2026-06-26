import { NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

const ALLOWED_STATUSES = ['uploaded', 'pending_review', 'approved', 'rejected'] as const;

export async function POST(request: Request) {
  try {
    const auth = await requireAdminUser();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { docId, status, rejectionReason } = await request.json();

    if (!docId || !ALLOWED_STATUSES.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const updateData: {
      status: string;
      reviewed_at: string;
      rejection_reason?: string | null;
    } = {
      status,
      reviewed_at: new Date().toISOString(),
    };

    if (status === 'rejected' && rejectionReason) {
      updateData.rejection_reason = rejectionReason;
    } else if (status === 'approved') {
      updateData.rejection_reason = null;
    }

    const { error } = await auth.admin
      .from('driver_documents')
      .update(updateData)
      .eq('id', docId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Status update error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}