import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';

export interface AuthenticatedContext {
  user: User;
  supabase: SupabaseClient;
}

/**
 * Validates the Supabase JWT sent from the client (Authorization: Bearer <token>).
 */
export async function getAuthenticatedUser(
  request: NextRequest
): Promise<AuthenticatedContext | null> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) return null;

  const supabase = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;
  return { user, supabase };
}