import { supabase } from '@/lib/supabase';

/**
 * Authenticated fetch wrapper — attaches the current Supabase session token.
 */
export async function authFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');

  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`);
  }

  return fetch(url, { ...options, headers });
}