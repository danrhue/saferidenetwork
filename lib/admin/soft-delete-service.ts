import type { SupabaseClient } from '@supabase/supabase-js';
import type { SoftDeleteEntityType } from '@/lib/soft-delete';

type SoftDeleteParams = {
  admin: SupabaseClient;
  entityType: SoftDeleteEntityType;
  entityId: string;
  performedBy: string;
  metadata?: Record<string, unknown>;
};

type AuditLogParams = Omit<SoftDeleteParams, 'admin'> & {
  action: 'soft_delete' | 'restore';
};

async function writeAuditLog(admin: SupabaseClient, params: AuditLogParams) {
  const { error } = await admin.from('soft_delete_audit_log').insert({
    entity_type: params.entityType,
    entity_id: params.entityId,
    action: params.action,
    performed_by: params.performedBy,
    metadata: params.metadata ?? {},
  });

  if (error) {
    console.error('Soft delete audit log error:', error);
  }
}

export async function softDeleteEntity({
  admin,
  entityType,
  entityId,
  performedBy,
  metadata,
}: SoftDeleteParams) {
  const table = entityType === 'profile' ? 'profiles' : 'trips';
  const now = new Date().toISOString();

  const { data, error } = await admin
    .from(table)
    .update({ deleted_at: now, deleted_by: performedBy, updated_at: now })
    .eq('id', entityId)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle();

  if (error) {
    return { ok: false as const, error: error.message };
  }

  if (!data) {
    return { ok: false as const, error: 'Record not found or already deleted.' };
  }

  await writeAuditLog(admin, {
    entityType,
    entityId,
    performedBy,
    metadata,
    action: 'soft_delete',
  });

  return { ok: true as const, deletedAt: now };
}

export async function restoreEntity({
  admin,
  entityType,
  entityId,
  performedBy,
  metadata,
}: SoftDeleteParams) {
  const table = entityType === 'profile' ? 'profiles' : 'trips';
  const now = new Date().toISOString();

  const { data, error } = await admin
    .from(table)
    .update({ deleted_at: null, deleted_by: null, updated_at: now })
    .eq('id', entityId)
    .not('deleted_at', 'is', null)
    .select('id')
    .maybeSingle();

  if (error) {
    return { ok: false as const, error: error.message };
  }

  if (!data) {
    return { ok: false as const, error: 'Record not found or not deleted.' };
  }

  await writeAuditLog(admin, {
    entityType,
    entityId,
    performedBy,
    metadata,
    action: 'restore',
  });

  return { ok: true as const };
}