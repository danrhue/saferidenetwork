import { NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/admin-auth';
import { restoreEntity, softDeleteEntity } from '@/lib/admin/soft-delete-service';
import type { SoftDeleteEntityType } from '@/lib/soft-delete';

export const dynamic = 'force-dynamic';

type RequestBody = {
  entityType?: SoftDeleteEntityType;
  id?: string;
  action?: 'soft_delete' | 'restore';
  metadata?: Record<string, unknown>;
};

export async function POST(request: Request) {
  const auth = await requireAdminUser();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { entityType, id, action = 'soft_delete', metadata } = body;

  if (!entityType || !id) {
    return NextResponse.json({ error: 'entityType and id are required' }, { status: 400 });
  }

  if (entityType !== 'profile' && entityType !== 'trip') {
    return NextResponse.json({ error: 'Invalid entityType' }, { status: 400 });
  }

  const params = {
    admin: auth.admin,
    entityType,
    entityId: id,
    performedBy: auth.user.id,
    metadata,
  };

  const result =
    action === 'restore' ? await restoreEntity(params) : await softDeleteEntity(params);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ success: true, action, ...result });
}