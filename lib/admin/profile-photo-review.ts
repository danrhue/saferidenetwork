import type { SupabaseClient } from '@supabase/supabase-js';
import { getProfilePhotoPublicUrl } from '@/lib/storage/profile-photos';

export type ProfilePhotoReviewAction = 'approved' | 'rejected';

export type ProfilePhotoReviewResult = {
  succeeded: string[];
  failed: { profileId: string; error: string }[];
};

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

    const { error: updateError } = await admin
      .from('profiles')
      .update({
        profile_photo_status: action,
        profile_photo_rejection_reason: trimmedReason,
        profile_photo_last_reviewed_at: now,
        profile_photo_last_reviewed_by: adminUserId,
        updated_at: now,
      })
      .eq('id', profileId);

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
      failed.push({ profileId, error: `Review saved but audit log failed: ${auditError.message}` });
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

  if (error || !logs?.length) return {};

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

export async function listDriverProfilePhotos(
  admin: SupabaseClient,
  filters: ProfilePhotoListFilters = {}
) {
  const status = filters.status ?? 'pending';

  let query = admin
    .from('profiles')
    .select(
      'id, full_name, phone, email, profile_photo_url, profile_photo_status, profile_photo_rejection_reason, profile_photo_last_reviewed_at, profile_photo_last_reviewed_by, updated_at'
    )
    .eq('role', 'driver')
    .not('profile_photo_url', 'is', null)
    .order('updated_at', { ascending: false });

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

  const { data, error } = await query;
  if (error) throw error;

  const rows = data ?? [];
  const auditByProfile = await fetchLatestAuditByProfileIds(
    admin,
    rows.map((r) => r.id)
  );

  return rows.map((row) => ({
    ...row,
    photo_url: getProfilePhotoPublicUrl(row.profile_photo_url),
    last_audit: auditByProfile[row.id] ?? null,
  }));
}