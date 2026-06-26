'use client';

/**
 * Rider matching preferences — auto-match vs manual offer review.
 * Saved to profiles.default_matching_mode and used by the trip request wizard.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import RiderBackLink from '@/components/rider/RiderBackLink';
import RiderLoadingSpinner from '@/components/rider/RiderLoadingSpinner';
import {
  riderCardClass,
  riderPrimaryButtonClass,
  riderSecondaryButtonClass,
} from '@/lib/rider/ui';

type MatchingMode = 'auto_first_offer' | 'manual_review';

const OPTIONS: { value: MatchingMode; title: string; description: string }[] = [
  {
    value: 'auto_first_offer',
    title: 'Auto-match first driver',
    description:
      'The first available driver is assigned automatically. You have 60 seconds to confirm or decline before the match is finalized.',
  },
  {
    value: 'manual_review',
    title: 'Review offers manually',
    description:
      'Drivers submit offers for your trip. You review each offer and choose the driver that works best for you.',
  },
];

export default function RiderMatchingSettingsPage() {
  const [matchingMode, setMatchingMode] = useState<MatchingMode>('auto_first_offer');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadPreference = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError('Please sign in to view matching settings.');
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('default_matching_mode')
        .eq('id', user.id)
        .single();

      if (fetchError) throw fetchError;

      if (
        data?.default_matching_mode === 'auto_first_offer' ||
        data?.default_matching_mode === 'manual_review'
      ) {
        setMatchingMode(data.default_matching_mode);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPreference();
  }, [loadPreference]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Please sign in to save preferences.');

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          default_matching_mode: matchingMode,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (updateError) throw updateError;
      setSuccess('Matching preference saved. New trip requests will use this setting.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save preference');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <RiderLoadingSpinner message="Loading matching settings..." />;
  }

  return (
    <div className="mx-auto max-w-2xl">
      <RiderBackLink href="/rider/dashboard" label="Back to dashboard" />

      <h1 className="text-3xl font-bold text-blue-950">Matching settings</h1>
      <p className="mt-2 text-blue-800">
        Choose how you want to be matched with drivers when you request a ride.
      </p>

      {error && (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}

      <form onSubmit={handleSave} className="mt-8 space-y-4">
        <div className={riderCardClass}>
          <fieldset>
            <legend className="sr-only">Matching mode</legend>
            <div className="space-y-4">
              {OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`block cursor-pointer rounded-2xl border-2 p-5 transition ${
                    matchingMode === option.value
                      ? 'border-[#1E3A8A] bg-blue-50'
                      : 'border-blue-200 bg-white hover:border-blue-300'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <input
                      type="radio"
                      name="matchingMode"
                      value={option.value}
                      checked={matchingMode === option.value}
                      onChange={() => setMatchingMode(option.value)}
                      className="mt-1 h-4 w-4 accent-[#1E3A8A]"
                    />
                    <div>
                      <p className="font-semibold text-blue-950">{option.title}</p>
                      <p className="mt-1 text-sm text-blue-800">{option.description}</p>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        {success && (
          <p className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            {success}
          </p>
        )}

        <div className="flex flex-wrap gap-3 pt-2">
          <button type="submit" disabled={saving} className={riderPrimaryButtonClass}>
            {saving ? 'Saving...' : 'Save preference'}
          </button>
          <Link href="/rider/dashboard" className={riderSecondaryButtonClass}>
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}