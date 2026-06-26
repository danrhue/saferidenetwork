export const DEACTIVATED_ACCOUNT_MESSAGE =
  'Your account has been deactivated by an administrator.';

export type SoftDeleteEntityType = 'profile' | 'trip';

export type SoftDeleteAuditAction = 'soft_delete' | 'restore';

export type SoftDeletableRow = {
  id: string;
  deleted_at?: string | null;
  deleted_by?: string | null;
};

export type SoftDeleteAuditEntry = {
  id: string;
  entity_type: SoftDeleteEntityType;
  entity_id: string;
  action: SoftDeleteAuditAction;
  performed_by: string | null;
  performed_at: string;
  metadata?: Record<string, unknown> | null;
};

/** Apply active-only filter unless admin explicitly requests deleted rows. */
export function applyDeletedFilter<T extends { is: Function; not: Function }>(
  query: T,
  showDeleted: boolean,
  onlyDeleted = false
): T {
  if (onlyDeleted || showDeleted) {
    return query.not('deleted_at', 'is', null) as T;
  }
  return query.is('deleted_at', null) as T;
}

export function isSoftDeleted(row: { deleted_at?: string | null } | null | undefined): boolean {
  return Boolean(row?.deleted_at);
}