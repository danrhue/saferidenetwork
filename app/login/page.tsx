'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { DEACTIVATED_ACCOUNT_MESSAGE } from '@/lib/soft-delete';

/** Route authenticated users to the correct portal by profile role. */
function getDashboardPathForRole(role: string | null | undefined): string {
  if (role === 'organization') return '/organization/dashboard';
  if (role === 'rider') return '/rider/dashboard';
  return '/dashboard';
}

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) throw signInError;

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role, deleted_at')
        .eq('id', data.user.id)
        .single();

      if (profileError) {
        console.error('Profile fetch error:', profileError);
      }

      if (profile?.deleted_at) {
        await supabase.auth.signOut();
        setError(DEACTIVATED_ACCOUNT_MESSAGE);
        return;
      }

      const userRole = profile?.role || 'driver';
      router.push(getDashboardPathForRole(userRole));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Sign in failed';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow">
        <h1 className="text-3xl font-bold text-center mb-2 text-blue-950">Welcome Back</h1>
        <p className="text-center text-blue-800 mb-8">
          Sign in to the Organization, Driver, or Rider Portal
        </p>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-blue-950 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border rounded-xl px-4 py-3 text-blue-950 placeholder:text-blue-600"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-blue-950 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border rounded-xl px-4 py-3 text-blue-950 placeholder:text-blue-600"
              required
            />
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-medium disabled:opacity-70"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="text-center mt-4">
          <Link href="/forgot-password" className="text-sm text-blue-600 hover:underline">
            Forgot password?
          </Link>
        </div>

        <p className="text-center text-sm text-blue-800 mt-4">
          Don&apos;t have an account?{' '}
          <Link href="/sign-up" className="text-blue-600 hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}