'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
/** Set true to skip profile/admin checks during debugging. REMOVE before production. */
const ADMIN_LOGIN_BYPASS = true;

function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const queryError = searchParams.get('error');
    if (queryError) {
      setError(queryError);
    }
  }, [searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) throw signInError;

      if (ADMIN_LOGIN_BYPASS) {
        // TEMPORARY BYPASS — skip all active/deleted/is_admin checks
        console.warn('⚠️ ADMIN LOGIN BYPASS ACTIVE');
        router.push('/admin/drivers');
        return;
      }

      router.push('/admin');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow">
        <h1 className="text-3xl font-bold text-center mb-2 text-blue-950">Admin Login</h1>
        <p className="text-center text-blue-800 mb-8">
          Sign in to review documents, trips, and platform operations
        </p>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-blue-950 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border rounded-xl px-4 py-3 text-blue-950"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-blue-950 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border rounded-xl px-4 py-3 text-blue-950"
              required
            />
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#1E3A8A] hover:bg-blue-900 text-white py-3 rounded-xl font-medium disabled:opacity-70"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="text-center mt-6 space-y-2">
          <Link href="/forgot-password" className="block text-sm text-blue-600 hover:underline">
            Forgot password?
          </Link>
          <Link href="/" className="block text-sm text-blue-800 hover:underline">
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function AdminLogin() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50 text-blue-950">
          Loading...
        </div>
      }
    >
      <AdminLoginForm />
    </Suspense>
  );
}