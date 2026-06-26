import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import { fetchAuthEmailsByUserIds } from '@/lib/admin/auth-user-email';
import { getErrorMessage } from '@/lib/errors';
import { resolveAdminProfilePhotoUrl } from '@/lib/storage/profile-photos';

export type ProfilePhotoReviewAction = 'approved' | 'rejected';

export type ProfilePhotoReviewResult = {
  succeeded: string[];
  failed: { profileId: string; error: string }[];
};

/**
 * Email lives in auth.users only — never select profiles.email.
 * Profiles query is the single source of truth; emails are enriched via service role.
 */
const PROFILE_PHOTO_PROFILES_SELECT =
  'id, full_name, phone, profile_photo_url, profile_photo_status, profile_photo_rejection_reason, updated_at';

type ProfilePhotoListRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email?: string | null;
  profile_photo_url: string | null;
  profile_photo_status: string | null;
  profile_photo_rejection_reason: string | null;
  updated_at: string | null;
  deleted_at?: string | null;
};

function isMissingColumnError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('column') &&
    (lower.includes('does not exist') || lower.includes('could not find'))
  );
}

function isMissingRelationError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    (lower.includes('relation') && lower.includes('does not exist')) ||
    lower.includes('could not find the table') ||
    lower.includes('schema cache')
  );
}

function isProfilesEmailColumnError(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes('profiles.email') || lower.includes('column') && lower.includes('email');
}

function throwQueryError(context: string, error: PostgrestError): never {
  console.error(`[profile-photo-review] ${context}:`, {
    message: error.message,
    code: error.code,
    details: error.details,
    hint: error.hint,
  });
  throw new Error(error.message);
}

export async function reviewDriverProfilePhotos(
  admin: SupabaseClient,
  adminUserId: string,
  profileIds: string[],
  action: ProfilePhotoReviewAction,
  rejectionReason?: string
): Promise<ProfilePhotoReviewResult> {
  const uniqueIds = [...new Set(profileIds.filter(Boolean))];
  const succeeded: string[] = [];
  const failed: { profileId: string; error: string }[] = [];

  if (uniqueIds.length === 0) {
    return { succeeded, failed: [{ profileId: '', error: 'No profile IDs provided' }] };
  }

  if (action === 'rejected') {
    const trimmed = rejectionReason?.trim() ?? '';
    if (!trimmed) {
      return {
        succeeded,
        failed: uniqueIds.map((id) => ({
          profileId: id,
          error: 'A rejection reason is required',
        })),
      };
    }
  }

  const now = new Date().toISOString();
  const trimmedReason =
    action === 'rejected' ? (rejectionReason?.trim() ?? null) : null;

  for (const profileId of uniqueIds) {
    const { data: driver, error: driverError } = await admin
      .from('profiles')
      .select('id, profile_photo_status, profile_photo_url')
      .eq('id', profileId)
      .eq('role', 'driver')
      .single();

    if (driverError || !driver) {
      failed.push({ profileId, error: 'Driver not found' });
      continue;
    }

    if (driver.profile_photo_status !== 'pending' || !driver.profile_photo_url) {
      failed.push({
        profileId,
        error: 'Driver does not have a pending profile photo',
      });
      continue;
    }

    const fullUpdate = {
      profile_photo_status: action,
      profile_photo_rejection_reason: trimmedReason,
      profile_photo_last_reviewed_at: now,
      profile_photo_last_reviewed_by: adminUserId,
      updated_at: now,
    };

    const minimalUpdate = {
      profile_photo_status: action,
      profile_photo_rejection_reason: trimmedReason,
      updated_at: now,
    };

    let updateError = (
      await admin.from('profiles').update(fullUpdate).eq('id', profileId)
    ).error;

    if (updateError && isMissingColumnError(updateError.message)) {
      console.warn(
        '[profile-photo-review] Optional review metadata columns missing; applying minimal update.',
        updateError.message
      );
      updateError = (
        await admin.from('profiles').update(minimalUpdate).eq('id', profileId)
      ).error;
    }

    if (updateError) {
      failed.push({ profileId, error: updateError.message });
      continue;
    }

    const { error: auditError } = await admin.from('profile_photo_audit_log').insert({
      profile_id: profileId,
      admin_id: adminUserId,
      action,
      rejection_reason: trimmedReason,
      created_at: now,
    });

    if (auditError) {
      if (isMissingRelationError(auditError.message)) {
        console.error(
          '[profile-photo-review] Audit log table missing — review saved without audit entry. Run profile_photo_audit_log_migration.sql.',
          auditError.message
        );
        succeeded.push(profileId);
        continue;
      }

      failed.push({
        profileId,
        error: `Review saved but audit log failed: ${auditError.message}`,
      });
      continue;
    }

    succeeded.push(profileId);
  }

  return { succeeded, failed };
}

export type ProfilePhotoAuditEntry = {
  id: string;
  profile_id: string;
  admin_id: string;
  action: ProfilePhotoReviewAction;
  rejection_reason: string | null;
  created_at: string;
  admin_name: string | null;
};

export async function fetchLatestAuditByProfileIds(
  admin: SupabaseClient,
  profileIds: string[]
): Promise<Record<string, ProfilePhotoAuditEntry>> {
  if (profileIds.length === 0) return {};

  const { data: logs, error } = await admin
    .from('profile_photo_audit_log')
    .select('id, profile_id, admin_id, action, rejection_reason, created_at')
    .in('profile_id', profileIds)
    .order('created_at', { ascending: false });

  if (error) {
    if (isMissingRelationError(error.message)) {
      console.warn(
        '[profile-photo-review] Audit log table not found; skipping last-audit lookup. Run profile_photo_audit_log_migration.sql.'
      );
      return {};
    }
    console.error('[profile-photo-review] Audit log fetch error:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
    return {};
  }

  if (!logs?.length) return {};

  const adminIds = [...new Set(logs.map((l) => l.admin_id))];
  const { data: admins } = await admin
    .from('profiles')
    .select('id, full_name')
    .in('id', adminIds);

  const adminNameById = Object.fromEntries(
    (admins ?? []).map((a) => [a.id, a.full_name as string | null])
  );

  const latestByProfile: Record<string, ProfilePhotoAuditEntry> = {};
  for (const log of logs) {
    if (latestByProfile[log.profile_id]) continue;
    latestByProfile[log.profile_id] = {
      ...log,
      action: log.action as ProfilePhotoReviewAction,
      admin_name: adminNameById[log.admin_id] ?? null,
    };
  }

  return latestByProfile;
}

export type ProfilePhotoListFilters = {
  status?: 'pending' | 'approved' | 'rejected' | 'all';
  from?: string | null;
  to?: string | null;
};

function buildProfilePhotoListQuery(
  admin: SupabaseClient,
  filters: ProfilePhotoListFilters,
  options?: { excludeDeleted?: boolean }
) {
  const status = filters.status ?? 'pending';

  let query = admin
    .from('profiles')
    .select(PROFILE_PHOTO_PROFILES_SELECT)
    .eq('role', 'driver')
    .not('profile_photo_url', 'is', null)
    .order('updated_at', { ascending: false });

  if (options?.excludeDeleted !== false) {
    query = query.is('deleted_at', null);
  }

  if (status !== 'all') {
    query = query.eq('profile_photo_status', status);
  }

  if (filters.from) {
    const fromDate = new Date(filters.from);
    if (!Number.isNaN(fromDate.getTime())) {
      query = query.gte('updated_at', fromDate.toISOString());
    }
  }

  if (filters.to) {
    const toDate = new Date(filters.to);
    if (!Number.isNaN(toDate.getTime())) {
      toDate.setHours(23, 59, 59, 999);
      query = query.lte('updated_at', toDate.toISOString());
    }
  }

  return query;
}

async function attachAuthEmails(
  admin: SupabaseClient,
  rows: ProfilePhotoListRow[]
): Promise<ProfilePhotoListRow[]> {
  if (rows.length === 0) return rows;

  const emailById = await fetchAuthEmailsByUserIds(
    admin,
    rows.map((row) => row.id)
  );

  return rows.map((row) => ({
    ...row,
    email: emailById[row.id] ?? null,
  }));
}

async function loadProfilePhotoRows(
  admin: SupabaseClient,
  filters: ProfilePhotoListFilters
): Promise<ProfilePhotoListRow[]> {
  let { data, error } = await buildProfilePhotoListQuery(admin, filters);

  if (
    error &&
    (isMissingRelationError(error.message) ||
      error.message.includes('driver_profile_photos_admin_view'))
  ) {
    console.warn(
      '[profile-photo-review] Ignoring missing admin view — querying profiles directly.'
    );
    ({ data, error } = await buildProfilePhotoListQuery(admin, filters));
  }

  if (error && isMissingColumnError(error.message) && error.message.includes('deleted_at')) {
    console.warn(
      '[profile-photo-review] deleted_at column missing; listing without soft-delete filter.'
    );
    ({ data, error } = await buildProfilePhotoListQuery(admin, filters, {
      excludeDeleted: false,
    }));
  }

  if (error && isProfilesEmailColumnError(error.message)) {
    console.error(
      '[profile-photo-review] Unexpected profiles.email in query — verify deployed code uses PROFILE_PHOTO_PROFILES_SELECT only.',
      error.message
    );
    throw new Error(
      'Profile photo query referenced profiles.email. Deploy the latest admin API build.'
    );
  }

  if (error) {
    throwQueryError('Profile photo list query failed', error);
  }

  const rows = (data ?? []) as unknown as ProfilePhotoListRow[];
  return attachAuthEmails(admin, rows);
}

export async function listDriverProfilePhotos(
  admin: SupabaseClient,
  filters: ProfilePhotoListFilters = {}
) {
  const rows = await loadProfilePhotoRows(admin, filters);
  const auditByProfile = await fetchLatestAuditByProfileIds(
    admin,
    rows.map((r) => r.id)
  );

  return Promise.all(
    rows.map(async (row) => ({
      id: row.id,
      full_name: row.full_name,
      phone: row.phone,
      email: row.email ?? null,
      profile_photo_url: row.profile_photo_url,
      profile_photo_status: row.profile_photo_status,
      profile_photo_rejection_reason: row.profile_photo_rejection_reason,
      updated_at: row.updated_at,
      photo_url: await resolveAdminProfilePhotoUrl(admin, row.profile_photo_url),
      last_audit: auditByProfile[row.id] ?? null,
    }))
  );
}

export async function fetchProfilePhotoAuditHistory(
  admin: SupabaseClient,
  profileId: string
): Promise<ProfilePhotoAuditEntry[]> {
  const { data: logs, error } = await admin
    .from('profile_photo_audit_log')
    .select('id, profile_id, admin_id, action, rejection_reason, created_at')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false });

  if (error) {
    if (isMissingRelationError(error.message)) {
      console.warn('[profile-photo-review] Audit log table not found for history lookup.');
      return [];
    }
    console.error('[profile-photo-review] Audit history error:', getErrorMessage(error));
    return [];
  }

  if (!logs?.length) return [];

  const adminIds = [...new Set(logs.map((l) => l.admin_id))];
  const { data: admins } = await admin
    .from('profiles')
    .select('id, full_name')
    .in('id', adminIds);

  const adminNameById = Object.fromEntries(
    (admins ?? []).map((a) => [a.id, a.full_name as string | null])
  );

  return logs.map((log) => ({
    ...log,
    action: log.action as ProfilePhotoReviewAction,
    admin_name: adminNameById[log.admin_id] ?? null,
  }));
}