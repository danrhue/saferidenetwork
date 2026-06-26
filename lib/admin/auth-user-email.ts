import type { SupabaseClient } from '@supabase/supabase-js';

/** Load emails from auth.users via the Admin Auth API (service role). */
export async function fetchAuthEmailsByUserIds(
  admin: SupabaseClient,
  userIds: string[]
): Promise<Record<string, string>> {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  const emailById: Record<string, string> = {};

  await Promise.all(
    uniqueIds.map(async (userId) => {
      const { data, error } = await admin.auth.admin.getUserById(userId);
      if (error) {
        console.warn('[auth-user-email] getUserById failed:', userId, error.message);
        return;
      }
      if (data.user?.email) {
        emailById[userId] = data.user.email;
      }
    })
  );

  return emailById;
}