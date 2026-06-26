'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import DrivingStateMultiSelect from '@/components/driver/DrivingStateMultiSelect';
import { normalizeStateCodes } from '@/lib/driver/us-states';
import { draftToSignupHints, getRiderTripDraft } from '@/lib/rider/trip-draft';

type AccountRole = 'driver' | 'organization' | 'rider';

function SignUpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<AccountRole>('driver');
  const [drivingStates, setDrivingStates] = useState<string[]>([]);
  const [organizationName, setOrganizationName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Pre-select role from query string (?role=driver or ?type=driver from Apply to Drive funnel)
  useEffect(() => {
    const roleParam = searchParams.get('role') ?? searchParams.get('type');
    if (roleParam === 'rider' || roleParam === 'organization' || roleParam === 'driver') {
      setRole(roleParam);
    }

    // Pre-fill contact fields from Get a Ride session draft
    const draft = getRiderTripDraft();
    if (draft) {
      const hints = draftToSignupHints(draft);
      if (hints.fullName) setFullName(hints.fullName);
      if (hints.email) setEmail(hints.email);
    }
  }, [searchParams]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (role === 'organization' && !organizationName.trim()) {
      setError('Please enter your organization name');
      return;
    }

    if (role === 'driver' && drivingStates.length === 0) {
      setError('Please select at least one state where you plan to drive');
      return;
    }

    setLoading(true);

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role,
            organization_name: role === 'organization' ? organizationName : null,
          },
        },
      });

      if (signUpError) throw signUpError;

      // Create or update profile row with role (for login queries and RLS)
      if (data.user) {
        const { error: profileError } = await supabase.from('profiles').upsert({
          id: data.user.id,
          full_name: fullName,
          role,
          organization_name: role === 'organization' ? organizationName : null,
          driving_states:
            role === 'driver' ? normalizeStateCodes(drivingStates) : [],
          default_matching_mode: role === 'rider' ? 'auto_first_offer' : undefined,
        });

        if (profileError) {
          console.error('Profile upsert error:', profileError);
        }
      }

      // If email confirmation is disabled, Supabase returns a session — route by role
      if (data.session) {
        if (role === 'organization') {
          router.push('/organization/dashboard');
        } else if (role === 'rider') {
          // Funnel: continue to Trip Request Wizard with sessionStorage draft pre-filled
          router.push('/rider/trips/new');
        } else {
          router.push('/dashboard');
        }
        return;
      }

      router.push('/login?message=Please check your email to confirm your account');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Sign up failed';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const roleCardClass = (value: AccountRole) =>
    `p-4 border-2 rounded-xl text-left transition ${
      role === value ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
    }`;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="max-w-lg w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-blue-950">Create an Account</h1>
          <p className="text-blue-800 mt-2">Join Safe Ride Network</p>
        </div>

        <div className="bg-white p-8 rounded-2xl shadow">
          <form onSubmit={handleSignUp} className="space-y-6">
            {/* Role Selection */}
            <div>
              <label className="block text-sm font-medium text-blue-950 mb-3">I am registering as:</label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => setRole('driver')}
                  className={roleCardClass('driver')}
                >
                  <div className="font-semibold text-blue-950">Driver</div>
                  <div className="text-sm text-blue-800 mt-1">Offer to complete trips</div>
                </button>

                <button
                  type="button"
                  onClick={() => setRole('organization')}
                  className={roleCardClass('organization')}
                >
                  <div className="font-semibold text-blue-950">Organization</div>
                  <div className="text-sm text-blue-800 mt-1">Post trips for drivers</div>
                </button>

                <button
                  type="button"
                  onClick={() => setRole('rider')}
                  className={roleCardClass('rider')}
                >
                  <div className="font-semibold text-blue-950">I need a ride</div>
                  <div className="text-sm text-blue-800 mt-1">Book personal transportation</div>
                </button>
              </div>
            </div>

            {/* Organization Name (only for Organization) */}
            {role === 'organization' && (
              <div>
                <label className="block text-sm font-medium text-blue-950 mb-1">Organization Name</label>
                <input
                  type="text"
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                  className="w-full border rounded-xl px-4 py-3 text-blue-950 placeholder:text-blue-600"
                  placeholder="ABC School District"
                  required
                />
              </div>
            )}

            {role === 'driver' && (
              <DrivingStateMultiSelect value={drivingStates} onChange={setDrivingStates} />
            )}

            <div>
              <label className="block text-sm font-medium text-blue-950 mb-1">Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full border rounded-xl px-4 py-3 text-blue-950 placeholder:text-blue-600"
                placeholder="John Doe"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-blue-950 mb-1">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border rounded-xl px-4 py-3 text-blue-950 placeholder:text-blue-600"
                placeholder="you@example.com"
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
                placeholder="••••••••"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-blue-950 mb-1">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full border rounded-xl px-4 py-3 text-blue-950 placeholder:text-blue-600"
                placeholder="••••••••"
                required
              />
            </div>

            {error && <p className="text-red-600 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-medium disabled:opacity-70"
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-sm text-blue-800 mt-6">
            Already have an account?{' '}
            <Link href="/login" className="text-blue-600 hover:underline">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function SignUp() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gray-50 text-blue-950">
          Loading...
        </div>
      }
    >
      <SignUpForm />
    </Suspense>
  );
}