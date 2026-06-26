export const ADMIN_FORBIDDEN_ERROR = 'Forbidden — admin only';

export type AdminAccessProfile = {
  is_admin?: boolean | null;
  deleted_at?: string | null;
  role?: string | null;
};

/** True when the profile is an active (non-deleted) administrator. */
export function canAccessAdmin(profile: AdminAccessProfile | null | undefined): boolean {
  return Boolean(profile?.is_admin && !profile?.deleted_at);
}