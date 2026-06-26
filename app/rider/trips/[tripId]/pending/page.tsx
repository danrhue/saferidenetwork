'use client';

/**
 * Pending assignment buffer — countdown, driver preview, confirm/decline.
 * Phase 2: Supabase Realtime instead of polling when timer expires.
 */

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { getVisibleProfilePhotoPath } from '@/lib/profile-photo';
import { resolveProfilePhotoUrl } from '@/lib/storage/profile-photos';
import { authFetch } from '@/lib/auth-fetch';
import DriverRatingSummary from '@/components/rider/DriverRatingSummary';
import RiderLoadingSpinner from '@/components/rider/RiderLoadingSpinner';
import { riderDangerButtonClass } from '@/lib/rider/ui';

type DriverPreview = {
  id: string;
  full_name: string | null;
  profile_photo_url: string | null;
  vehicle_year: number | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  passenger_capacity: number | null;
};

type PendingState = {
  tripId: string;
  title: string;
  status: string;
  assignmentExpiresAt: string | null;
  offerId: string | null;
  driver: DriverPreview | null;
};

function PendingAssignmentContent() {
  const params = useParams();
  const router = useRouter();
  const tripId = params.tripId as string;

  const [state, setState] = useState<PendingState | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  const loadPendingState = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .select('id, title, status, assignment_expires_at, rider_id, matching_mode')
      .eq('id', tripId)
      .eq('rider_id', user.id)
      .single();

    if (tripError || !trip) {
      throw new Error('Trip not found or you do not have access.');
    }

    if (trip.matching_mode === 'manual_review') {
      router.replace(`/rider/trips/${tripId}/offers`);
      return null;
    }

    // Redirect if no longer in buffer
    if (trip.status === 'assigned') {
      router.replace(`/rider/trips/${tripId}`);
      return null;
    }

    if (trip.status === 'open') {
      router.replace(`/rider/trips/${tripId}`);
      return null;
    }

    if (trip.status !== 'pending_assignment') {
      router.replace(`/rider/trips/${tripId}`);
      return null;
    }

    const { data: offer, error: offerError } = await supabase
      .from('trip_offers')
      .select('id, driver_id, status, offered_price')
      .eq('trip_id', tripId)
      .eq('status', 'pending_confirmation')
      .maybeSingle();

    if (offerError) {
      throw new Error(offerError.message);
    }

    let driver: DriverPreview | null = null;

    if (offer?.driver_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select(
          'id, full_name, profile_photo_url, profile_photo_status, vehicle_year, vehicle_make, vehicle_model, passenger_capacity'
        )
        .eq('id', offer.driver_id)
        .single();

      const visiblePath = profile ? getVisibleProfilePhotoPath(profile) : null;
      const photoUrl = visiblePath
        ? await resolveProfilePhotoUrl(supabase, visiblePath)
        : null;

      driver = {
        id: offer.driver_id,
        full_name: profile?.full_name ?? null,
        profile_photo_url: photoUrl,
        vehicle_year: profile?.vehicle_year ?? null,
        vehicle_make: profile?.vehicle_make ?? null,
        vehicle_model: profile?.vehicle_model ?? null,
        passenger_capacity: profile?.passenger_capacity ?? null,
      };
    }

    return {
      tripId: trip.id,
      title: trip.title,
      status: trip.status,
      assignmentExpiresAt: trip.assignment_expires_at,
      offerId: offer?.id ?? null,
      driver,
    };
  }, [tripId, router]);

  useEffect(() => {
    loadPendingState()
      .then((data) => {
        if (data) setState(data);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load assignment');
      })
      .finally(() => setLoading(false));
  }, [loadPendingState]);

  // Countdown timer
  useEffect(() => {
    if (!state?.assignmentExpiresAt) return;

    const tick = () => {
      const remaining = Math.max(
        0,
        Math.ceil((new Date(state.assignmentExpiresAt!).getTime() - Date.now()) / 1000)
      );
      setSecondsLeft(remaining);
    };

    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [state?.assignmentExpiresAt]);

  // Auto-finalize when countdown reaches zero
  useEffect(() => {
    if (!state || secondsLeft > 0 || finalizing) return;

    const finalize = async () => {
      setFinalizing(true);
      try {
        const res = await authFetch('/api/rider/assignment/finalize', {
          method: 'POST',
          body: JSON.stringify({ tripId: state.tripId }),
        });

        const data = await res.json();

        if (res.ok && data.status === 'assigned') {
          router.replace(`/rider/trips/${state.tripId}?assigned=true`);
          return;
        }

        // Poll in case cron finalized first or race condition
        const refreshed = await loadPendingState();
        if (refreshed?.status === 'pending_assignment' && secondsLeft <= 0) {
          // Phase 2: Supabase Realtime for assignment updates
          setTimeout(() => loadPendingState().then((d) => d && setState(d)), 2000);
        }
      } catch {
        // Keep polling trip status
      } finally {
        setFinalizing(false);
      }
    };

    finalize();
  }, [secondsLeft, state, finalizing, router, loadPendingState]);

  // Poll trip status while buffer is active
  useEffect(() => {
    if (!state || state.status !== 'pending_assignment') return;

    const poll = setInterval(async () => {
      try {
        const refreshed = await loadPendingState();
        if (refreshed) setState(refreshed);
      } catch {
        // ignore transient poll errors
      }
    }, 3000);

    return () => clearInterval(poll);
  }, [state, loadPendingState]);

  const handleConfirmNow = async () => {
    if (!state?.offerId) return;
    setConfirming(true);
    setError('');

    try {
      const res = await authFetch('/api/rider/offers/accept', {
        method: 'POST',
        body: JSON.stringify({ tripId: state.tripId, offerId: state.offerId }),
      });

      const data = await res.json();
      console.log('[RiderPending] early accept result', {
        tripId: state.tripId,
        offerId: state.offerId,
        ok: res.ok,
        data,
      });

      if (!res.ok) {
        throw new Error(data.error || 'Failed to confirm driver');
      }

      router.replace(`/rider/trips/${state.tripId}?assigned=true`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to confirm driver');
    } finally {
      setConfirming(false);
    }
  };

  const handleCancel = async () => {
    if (!state) return;
    setCancelling(true);
    setError('');

    try {
      const res = await authFetch('/api/rider/assignment/cancel', {
        method: 'POST',
        body: JSON.stringify({ tripId: state.tripId }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to decline driver');
      }

      router.replace(`/rider/trips/${state.tripId}?declined=true`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to decline driver');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return <RiderLoadingSpinner message="Loading assignment..." />;
  }

  if (error && !state) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <p className="text-red-600">{error}</p>
        <Link href={`/rider/trips/${tripId}`} className="mt-4 inline-block text-sm font-medium text-[#1E3A8A] hover:underline">
          ← Back to trip
        </Link>
      </div>
    );
  }

  if (!state) return null;

  const vehicleLabel = [state.driver?.vehicle_year, state.driver?.vehicle_make, state.driver?.vehicle_model]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="mx-auto max-w-lg">
      <Link
        href={`/rider/trips/${tripId}`}
        className="mb-6 inline-flex items-center gap-1 text-sm font-medium text-[#1E3A8A] hover:underline"
      >
        ← Back to trip
      </Link>

      <h1 className="text-3xl font-bold text-blue-950">Confirm your driver</h1>
      <p className="mt-2 text-blue-800">
        A driver has been matched to your ride. Review their profile and confirm within the time shown.
      </p>

      {/* Countdown */}
      <div className="mt-6 rounded-2xl border border-blue-200 bg-white p-6 text-center shadow-sm">
        <p className="text-sm font-medium text-blue-800">Time remaining to decline</p>
        <div
          className={`mt-2 text-5xl font-bold tabular-nums ${
            secondsLeft <= 10 ? 'text-amber-600' : 'text-[#1E3A8A]'
          }`}
        >
          {secondsLeft}s
        </div>
        {secondsLeft === 0 && (
          <p className="mt-2 text-sm text-blue-800">
            {finalizing ? 'Confirming your driver...' : 'Assignment will be confirmed automatically.'}
          </p>
        )}
        {state.assignmentExpiresAt && (
          <p className="mt-1 text-xs text-blue-600">
            Expires at{' '}
            {new Date(state.assignmentExpiresAt).toLocaleTimeString(undefined, {
              hour: 'numeric',
              minute: '2-digit',
              second: '2-digit',
            })}
          </p>
        )}
      </div>

      {/* Driver card */}
      {state.driver ? (
        <div className="mt-6 rounded-2xl border border-blue-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-blue-950">Your matched driver</h2>
          <div className="mt-4 flex items-start gap-4">
            {state.driver.profile_photo_url ? (
              <img
                src={state.driver.profile_photo_url}
                alt={state.driver.full_name ?? 'Driver'}
                className="h-16 w-16 rounded-full border object-cover"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-2xl">
                👤
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-lg font-semibold text-blue-950">
                {state.driver.full_name ?? 'Vetted Driver'}
              </p>
              <DriverRatingSummary
                driverId={state.driver.id}
                driverName={state.driver.full_name}
                showLabel
                size="sm"
                className="mt-1"
              />
              {vehicleLabel && (
                <p className="mt-1 text-sm text-blue-800">
                  Vehicle: {vehicleLabel}
                  {state.driver.passenger_capacity
                    ? ` · ${state.driver.passenger_capacity} passengers`
                    : ''}
                </p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-dashed border-blue-200 bg-blue-50 p-6 text-sm text-blue-800">
          Waiting for driver details...
        </div>
      )}

      <p className="mt-4 text-sm text-blue-700">
        If you do nothing, this driver will be automatically confirmed when the timer ends.
      </p>

      {error && (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      )}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={handleConfirmNow}
          disabled={confirming || !state.offerId || secondsLeft === 0}
          className="flex-1 rounded-xl bg-[#1E3A8A] px-5 py-3 text-sm font-semibold text-white hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {confirming ? 'Confirming driver…' : 'Confirm driver now'}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          disabled={cancelling || secondsLeft === 0}
          className={`flex-1 ${riderDangerButtonClass} disabled:cursor-not-allowed`}
        >
          {cancelling ? 'Declining...' : 'Decline this driver'}
        </button>
      </div>
    </div>
  );
}

export default function PendingAssignmentPage() {
  return (
    <Suspense fallback={<div className="text-blue-800">Loading...</div>}>
      <PendingAssignmentContent />
    </Suspense>
  );
}