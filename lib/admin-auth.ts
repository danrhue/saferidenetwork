import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { ADMIN_FORBIDDEN_ERROR, canAccessAdmin } from '@/lib/admin-access';

/** Set true to skip admin API auth checks during debugging. REMOVE before production. */
const ADMIN_API_BYPASS = true;

/**
 * Server-only guard for admin pages/layouts.
 * Redirects unauthenticated users to login and non-admins to /admin with an error.
 */
export async function enforceAdminAccess() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/admin/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin, deleted_at, role')
    .eq('id', user.id)
    .single();

  if (!canAccessAdmin(profile)) {
    redirect(`/admin?error=${encodeURIComponent(ADMIN_FORBIDDEN_ERROR)}`);
  }

  return profile!;
}

export async function requireAdminUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false as const, status: 401, error: 'Unauthorized' };
  }

  const admin = getSupabaseAdmin();

  if (ADMIN_API_BYPASS) {
    console.warn('⚠️ ADMIN API BYPASS ACTIVE');
    return { ok: true as const, user, admin, profile: null };
  }

  const { data: profile, error } = await admin
    .from('profiles')
    .select('is_admin, deleted_at, role')
    .eq('id', user.id)
    .single();

  if (error || !canAccessAdmin(profile)) {
    return { ok: false as const, status: 403, error: ADMIN_FORBIDDEN_ERROR };
  }

  return { ok: true as const, user, admin, profile };
}