import { createClient, SupabaseClient } from '@supabase/supabase-js';

let adminClient: SupabaseClient | null = null;

/**
 * Service-role Supabase client for server-side operations (webhooks, transfers).
 * Never expose the service role key to the browser.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (!adminClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    }

    adminClient = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  return adminClient;
}