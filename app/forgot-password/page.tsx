'use client';

import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

      setSuccess('If an account exists with this email, a password reset link has been sent. Please check your inbox (and spam folder).');
      setEmail('');
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow">
        <h1 className="text-3xl font-bold text-center mb-2 text-blue-950">Forgot Password</h1>
        <p className="text-center text-blue-800 mb-8">Enter your email address and we'll send you a link to reset your password.</p>

        <form onSubmit={handleReset} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-blue-950 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border rounded-xl px-4 py-3 text-blue-950 placeholder:text-blue-600"
              placeholder="you@example.com"
              required
            />
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}
          {success && <p className="text-green-600 text-sm">{success}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-medium disabled:opacity-70"
          >
            {loading ? 'Sending...' : 'Send Reset Link'}
          </button>
        </form>

        <p className="text-center text-sm mt-6">
          <Link href="/login" className="text-blue-600 hover:underline">Back to login</Link>
        </p>
      </div>
    </div>
  );
}
