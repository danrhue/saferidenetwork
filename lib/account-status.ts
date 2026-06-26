import type { SupabaseClient } from '@supabase/supabase-js';
import { DEACTIVATED_ACCOUNT_MESSAGE } from '@/lib/soft-delete';

export type AccountStatus = {
  isDeactivated: boolean;
  deletedAt: string | null;
  isAdmin: boolean;
  role: string | null;
};

export async function fetchAccountStatus(
  supabase: SupabaseClient,
  userId: string
): Promise<AccountStatus | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('deleted_at, is_admin, role')
    .eq('id', userId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return {
    isDeactivated: Boolean(data.deleted_at),
    deletedAt: data.deleted_at ?? null,
    isAdmin: Boolean(data.is_admin),
    role: data.role ?? null,
  };
}

/** Signs the user out when their profile has been soft-deleted. */
export async function enforceActiveAccount(
  supabase: SupabaseClient,
  userId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const status = await fetchAccountStatus(supabase, userId);
  if (status?.isDeactivated) {
    await supabase.auth.signOut();
    return { ok: false, message: DEACTIVATED_ACCOUNT_MESSAGE };
  }
  return { ok: true };
}