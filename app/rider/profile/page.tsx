'use client';

/**
 * Rider profile — contact info and default accessibility notes.
 * Phone is required for SMS notifications when enabled.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import RiderBackLink from '@/components/rider/RiderBackLink';
import RiderLoadingSpinner from '@/components/rider/RiderLoadingSpinner';
import {
  riderInputClass,
  riderLabelClass,
  riderPrimaryButtonClass,
  riderSecondaryButtonClass,
  riderTextareaClass,
  riderCardClass,
} from '@/lib/rider/ui';

export default function RiderProfilePage() {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [accessibilityNeeds, setAccessibilityNeeds] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError('Please sign in to view your profile.');
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('full_name, phone, rider_accessibility_notes')
        .eq('id', user.id)
        .single();

      if (fetchError) {
        const { data: fallback, error: fallbackError } = await supabase
          .from('profiles')
          .select('full_name, phone')
          .eq('id', user.id)
          .single();

        if (fallbackError) throw fallbackError;
        setFullName(fallback?.full_name ?? '');
        setPhone(fallback?.phone ?? '');
        return;
      }

      setFullName(data?.full_name ?? '');
      setPhone(data?.phone ?? '');
      setAccessibilityNeeds(data?.rider_accessibility_notes ?? '');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Please sign in to save your profile.');

      const payload: Record<string, string | null> = {
        full_name: fullName.trim() || null,
        phone: phone.trim() || null,
        rider_accessibility_notes: accessibilityNeeds.trim() || null,
        updated_at: new Date().toISOString(),
      };

      const { error: updateError } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', user.id);

      if (updateError) {
        const { error: fallbackError } = await supabase
          .from('profiles')
          .update({
            full_name: payload.full_name,
            phone: payload.phone,
            updated_at: payload.updated_at,
          })
          .eq('id', user.id);

        if (fallbackError) throw fallbackError;
        setSuccess('Profile saved. Run rider_profile_polish.sql to persist accessibility notes.');
      } else {
        setSuccess('Profile saved successfully.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <RiderLoadingSpinner message="Loading your profile..." />;
  }

  return (
    <div className="mx-auto max-w-2xl">
      <RiderBackLink href="/rider/dashboard" label="Back to dashboard" />

      <h1 className="text-3xl font-bold text-blue-950">My Profile</h1>
      <p className="mt-2 text-blue-800">
        Keep your contact and accessibility information up to date for smoother trip coordination.
      </p>

      {!phone.trim() && (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Add a phone number to receive SMS trip alerts when enabled in{' '}
          <Link href="/rider/notifications" className="font-medium underline">
            Notification preferences
          </Link>
          .
        </p>
      )}

      {error && (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}

      <form onSubmit={handleSave} className="mt-8 space-y-6">
        <div className={riderCardClass}>
          <h2 className="mb-5 text-lg font-semibold text-blue-950">Personal information</h2>

          <div className="space-y-5">
            <div>
              <label htmlFor="fullName" className={riderLabelClass}>
                Full name
              </label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jane Rider"
                className={riderInputClass}
                autoComplete="name"
              />
            </div>

            <div>
              <label htmlFor="phone" className={riderLabelClass}>
                Phone number
              </label>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(555) 123-4567"
                className={riderInputClass}
                autoComplete="tel"
              />
              <p className="mt-2 text-xs text-blue-700">Used for SMS notifications and driver coordination.</p>
            </div>

            <div>
              <label htmlFor="accessibility" className={riderLabelClass}>
                Default accessibility needs
              </label>
              <textarea
                id="accessibility"
                value={accessibilityNeeds}
                onChange={(e) => setAccessibilityNeeds(e.target.value)}
                placeholder="Wheelchair access, service animal, extra assistance at pickup, etc."
                className={riderTextareaClass}
              />
              <p className="mt-2 text-xs text-blue-700">
                Pre-fills new trip requests. You can still adjust per ride.
              </p>
            </div>
          </div>
        </div>

        {success && (
          <p className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            {success}
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          <button type="submit" disabled={saving} className={riderPrimaryButtonClass}>
            {saving ? 'Saving...' : 'Save changes'}
          </button>
          <Link href="/rider/dashboard" className={riderSecondaryButtonClass}>
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}