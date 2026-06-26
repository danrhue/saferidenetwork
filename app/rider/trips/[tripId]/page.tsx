'use client';

/**
 * Trip detail — status-aware layout, driver card, map, rating, and actions.
 * Phase 2: Supabase Realtime for live driver location; policy-tier cancel/refund API.
 */

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { getVisibleProfilePhotoPath } from '@/lib/profile-photo';
import { resolveProfilePhotoUrl } from '@/lib/storage/profile-photos';
import TripStatusBadge from '@/components/rider/TripStatusBadge';
import TripTimeline from '@/components/rider/TripTimeline';
import DriverRatingForm from '@/components/rider/DriverRatingForm';
import DriverRatingSummary from '@/components/rider/DriverRatingSummary';
import TripMap from '@/app/components/TripMap';
import { fetchRiderReviewForTrip, type RiderDriverReview } from '@/lib/rider/reviews';
import RiderLoadingSpinner from '@/components/rider/RiderLoadingSpinner';
import RiderBackLink from '@/components/rider/RiderBackLink';
import {
  confirmRiderTripPayment,
  riderTripNeedsPayment,
  startRiderTripCheckout,
} from '@/lib/rider/checkout';
import { formatDateTime } from '@/lib/rider/format';
import { ASAP_EXPECTATIONS, CONTRACTOR_DISCLAIMER } from '@/lib/rider/schedule';
import { riderDangerButtonClass, riderPrimaryButtonClass } from '@/lib/rider/ui';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Trip + assigned driver profile embed */
const RIDER_TRIP_SELECT = `
  *,
  assigned_driver:profiles (
    id,
    full_name,
    avatar_url
  )
`.trim();

/** Fallback when profiles embed is unavailable */
const RIDER_TRIP_BASE_SELECT = '*';

type DriverProfileRow = {
  id: string;
  full_name: string | null;
  avatar_url?: string | null;
  phone?: string | null;
  profile_photo_url?: string | null;
  profile_photo_status?: string | null;
  vehicle_year?: number | null;
  vehicle_make?: string | null;
  vehicle_model?: string | null;
  passenger_capacity?: number | null;
};

type RiderTrip = {
  id: string;
  title: string;
  description: string | null;
  pickup_location: string;
  dropoff_location: string;
  pickup_time: string;
  status: string;
  payment_status: string | null;
  matching_mode: string | null;
  schedule_mode?: string | null;
  passengers: number | null;
  total_price: number | null;
  final_price: number | null;
  platform_fee: number | null;
  calculated_price: number | null;
  distance_miles: number | null;
  assignment_expires_at: string | null;
  assigned_driver_id: string | null;
  rider_id: string | null;
  start_lat: number | null;
  start_lng: number | null;
  end_lat: number | null;
  end_lng: number | null;
  current_lat: number | null;
  current_lng: number | null;
  last_location_update: string | null;
  started_at: string | null;
  ended_at: string | null;
  assigned_driver?: DriverProfileRow | DriverProfileRow[] | null;
};

type DriverInfo = {
  id: string;
  full_name: string | null;
  phone: string | null;
  profile_photo_url: string | null;
  vehicle_year: number | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  passenger_capacity: number | null;
};

type LoadState = 'loading' | 'ready' | 'not_found' | 'unauthorized' | 'error';

/** Poll while matching or shortly after assignment so status transitions appear quickly. */
function shouldPollRiderTrip(trip: RiderTrip | null): boolean {
  if (!trip) return false;
  if (['pending_assignment', 'assigned', 'in_progress'].includes(trip.status)) return true;
  if (trip.status === 'open' && trip.payment_status === 'paid') {
    return trip.matching_mode === 'auto_first_offer' || trip.matching_mode === 'manual_review';
  }
  return false;
}

function getTripPollIntervalMs(trip: RiderTrip): number {
  if (trip.status === 'open') return 4_000;
  if (trip.status === 'pending_assignment') return 5_000;
  if (trip.status === 'assigned') return 6_000;
  if (trip.status === 'in_progress') return 8_000;
  return 10_000;
}

function normalizeDriverEmbed(
  embed: DriverProfileRow | DriverProfileRow[] | null | undefined
): DriverProfileRow | null {
  if (!embed) return null;
  return Array.isArray(embed) ? embed[0] ?? null : embed;
}

async function resolveDriverPhoto(path: string | null): Promise<string | null> {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return resolveProfilePhotoUrl(supabase, path);
}

function driverPhotoSource(profile: DriverProfileRow): string | null {
  const visiblePath = getVisibleProfilePhotoPath(profile);
  return profile.avatar_url ?? visiblePath ?? null;
}

async function buildDriverInfo(profile: DriverProfileRow): Promise<DriverInfo> {
  const source = driverPhotoSource(profile);
  const photoUrl =
    source?.startsWith('http://') || source?.startsWith('https://')
      ? source
      : await resolveDriverPhoto(source);
  return {
    id: profile.id,
    full_name: profile.full_name,
    phone: profile.phone ?? null,
    profile_photo_url: photoUrl,
    vehicle_year: profile.vehicle_year ?? null,
    vehicle_make: profile.vehicle_make ?? null,
    vehicle_model: profile.vehicle_model ?? null,
    passenger_capacity: profile.passenger_capacity ?? null,
  };
}

async function loadDriverInfo(driverId: string): Promise<DriverInfo | null> {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select(
      'id, full_name, phone, profile_photo_url, profile_photo_status, vehicle_year, vehicle_make, vehicle_model, passenger_capacity'
    )
    .eq('id', driverId)
    .maybeSingle();

  if (error || !profile) return null;
  return buildDriverInfo(profile);
}

function mapTripFetchError(fetchError: { code?: string; message?: string } | null): string {
  if (!fetchError) return 'Trip not found.';
  if (fetchError.code === 'PGRST116') return 'Trip not found.';
  if (fetchError.message?.includes('column') || fetchError.code === '42703') {
    return 'Trip data is unavailable. Ask your administrator to apply rider_portal_phase1.sql in Supabase.';
  }
  return fetchError.message || 'Failed to load trip.';
}

function DriverCard({
  driver,
  showContact = false,
}: {
  driver: DriverInfo;
  showContact?: boolean;
}) {
  const vehicle = [driver.vehicle_year, driver.vehicle_make, driver.vehicle_model]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="rounded-2xl border border-blue-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-blue-950">Your driver</h2>
      <div className="mt-4 flex items-start gap-4">
        {driver.profile_photo_url ? (
          <img
            src={driver.profile_photo_url}
            alt={driver.full_name ?? 'Driver'}
            className="h-16 w-16 rounded-full border object-cover"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-2xl">
            👤
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-lg font-semibold text-blue-950">{driver.full_name ?? 'Vetted Driver'}</p>
          <DriverRatingSummary
            driverId={driver.id}
            driverName={driver.full_name}
            size="sm"
            className="mt-1"
          />
          {vehicle && (
            <p className="mt-1 text-sm text-blue-800">
              {vehicle}
              {driver.passenger_capacity ? ` · ${driver.passenger_capacity} seats` : ''}
            </p>
          )}
        </div>
      </div>
      {showContact && driver.phone && (
        <a
          href={`tel:${driver.phone.replace(/\D/g, '')}`}
          className="mt-4 inline-flex w-full items-center justify-center rounded-xl border border-blue-200 px-4 py-2.5 text-sm font-semibold text-[#1E3A8A] transition hover:bg-blue-50 sm:w-auto"
        >
          Call driver
        </a>
      )}
    </div>
  );
}

function PriceBreakdownCard({ trip }: { trip: RiderTrip }) {
  const driverComp = trip.final_price ?? trip.calculated_price;
  const platformFee = trip.platform_fee;
  const total = trip.total_price;

  if (total == null && driverComp == null) return null;

  return (
    <div className="rounded-2xl border border-blue-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-blue-950">Price summary</h2>
      <dl className="mt-4 space-y-2 text-sm">
        {trip.distance_miles != null && (
          <div className="flex justify-between text-blue-800">
            <dt>Distance</dt>
            <dd>{trip.distance_miles} mi</dd>
          </div>
        )}
        {driverComp != null && (
          <div className="flex justify-between text-blue-800">
            <dt>Driver compensation</dt>
            <dd>${Number(driverComp).toFixed(2)}</dd>
          </div>
        )}
        {platformFee != null && (
          <div className="flex justify-between text-blue-800">
            <dt>Platform fee</dt>
            <dd>${Number(platformFee).toFixed(2)}</dd>
          </div>
        )}
        {total != null && (
          <div className="flex justify-between border-t border-blue-100 pt-2 font-semibold text-blue-950">
            <dt>Total paid</dt>
            <dd>${Number(total).toFixed(2)}</dd>
          </div>
        )}
      </dl>
      {trip.payment_status && (
        <p className="mt-3 text-xs text-blue-700">
          Payment: <span className="capitalize">{trip.payment_status}</span>
        </p>
      )}
    </div>
  );
}

function TripAccessError({
  title,
  message,
  onRetry,
}: {
  title: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="mx-auto max-w-lg">
      <RiderBackLink href="/rider/trips" label="Back to My Trips" />
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
        <h1 className="text-lg font-semibold text-red-900">{title}</h1>
        <p className="mt-2 text-sm text-red-800">{message}</p>
        <div className="mt-5 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/rider/trips"
            className="text-sm font-semibold text-[#1E3A8A] hover:underline"
          >
            View all trips
          </Link>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="text-sm font-medium text-[#1E3A8A] hover:underline"
            >
              Try again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function RiderTripDetailContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const tripId = typeof params.tripId === 'string' ? params.tripId.trim() : '';

  const paymentSuccess = searchParams.get('success') === 'true';
  const checkoutSessionId = searchParams.get('session_id');
  const paymentCancelled = searchParams.get('cancelled') === 'true';
  const assignedSuccess = searchParams.get('assigned') === 'true';
  const declinedDriver = searchParams.get('declined') === 'true';

  const [trip, setTrip] = useState<RiderTrip | null>(null);
  const [driver, setDriver] = useState<DriverInfo | null>(null);
  const [existingReview, setExistingReview] = useState<RiderDriverReview | null>(null);
  const [bufferSecondsLeft, setBufferSecondsLeft] = useState<number | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [paying, setPaying] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [confirmAttemptCount, setConfirmAttemptCount] = useState(0);
  const [paymentConfirmTimedOut, setPaymentConfirmTimedOut] = useState(false);
  const [isRetryingPayment, setIsRetryingPayment] = useState(false);
  const [lastConfirmStatus, setLastConfirmStatus] = useState('');
  const [pendingOfferCount, setPendingOfferCount] = useState(0);
  const confirmAttemptsRef = useRef(0);
  const confirmInFlightRef = useRef(false);
  const pollGenerationRef = useRef(0);
  const prevTripStatusRef = useRef<string | null>(null);
  const MAX_CONFIRM_ATTEMPTS = 40;
  const POLL_INTERVAL_MS = 3_000;
  const INITIAL_POLL_DELAY_MS = 800;

  const resolveDriverForTrip = useCallback(
    async (tripRow: RiderTrip): Promise<DriverInfo | null> => {
      let driverId = tripRow.assigned_driver_id;

      if (tripRow.status === 'pending_assignment' && !driverId) {
        const { data: offer } = await supabase
          .from('trip_offers')
          .select('driver_id')
          .eq('trip_id', tripId)
          .eq('status', 'pending_confirmation')
          .maybeSingle();
        driverId = offer?.driver_id ?? null;
      }

      if (!driverId) return null;

      const full = await loadDriverInfo(driverId);
      const embedded = normalizeDriverEmbed(tripRow.assigned_driver);
      if (!embedded) return full;

      const fromEmbed = await buildDriverInfo(embedded);
      if (!full) return fromEmbed;

      return {
        ...full,
        full_name: embedded.full_name ?? full.full_name,
        profile_photo_url: fromEmbed.profile_photo_url ?? full.profile_photo_url,
      };
    },
    [tripId]
  );

  const refresh = useCallback(async () => {
    if (!tripId || !UUID_RE.test(tripId)) {
      setLoadState('error');
      setErrorMessage('This trip link is invalid.');
      setTrip(null);
      return;
    }

    setLoadState((prev) => (prev === 'ready' ? 'ready' : 'loading'));

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoadState('unauthorized');
        setErrorMessage('Please sign in to view this trip.');
        setTrip(null);
        return;
      }

      let data: RiderTrip | null = null;
      let fetchError: { code?: string; message?: string } | null = null;

      const joined = await supabase
        .from('trips')
        .select(RIDER_TRIP_SELECT)
        .eq('id', tripId)
        .eq('rider_id', user.id)
        .single();

      data = joined.data as RiderTrip | null;
      fetchError = joined.error;

      if (fetchError?.code === 'PGRST116') {
        data = null;
        fetchError = null;
      } else if (
        fetchError?.message?.includes('assigned_driver') ||
        fetchError?.message?.includes('profiles') ||
        fetchError?.message?.includes('avatar_url')
      ) {
        const fallback = await supabase
          .from('trips')
          .select(RIDER_TRIP_BASE_SELECT)
          .eq('id', tripId)
          .eq('rider_id', user.id)
          .single();

        data = fallback.data as RiderTrip | null;
        fetchError =
          fallback.error?.code === 'PGRST116' ? null : fallback.error;
        if (fallback.error?.code === 'PGRST116') data = null;
      }

      if (fetchError) {
        setLoadState('error');
        setErrorMessage(mapTripFetchError(fetchError));
        setTrip(null);
        return;
      }

      if (!data) {
        setLoadState('not_found');
        setErrorMessage(
          'We could not find this trip on your account. It may have been removed or belongs to another rider.'
        );
        setTrip(null);
        return;
      }

      const tripRow = data as RiderTrip;

      if (tripRow.rider_id && tripRow.rider_id !== user.id) {
        setLoadState('not_found');
        setErrorMessage('You do not have access to this trip.');
        setTrip(null);
        return;
      }

      if (prevTripStatusRef.current !== tripRow.status) {
        console.log('[RiderTripDetail] status transition', {
          tripId,
          from: prevTripStatusRef.current,
          to: tripRow.status,
          matching_mode: tripRow.matching_mode,
          payment_status: tripRow.payment_status,
          assigned_driver_id: tripRow.assigned_driver_id,
          assignment_expires_at: tripRow.assignment_expires_at,
        });
        prevTripStatusRef.current = tripRow.status;
      }

      setTrip(tripRow);
      setLoadState('ready');
      setErrorMessage('');

      if (
        tripRow.matching_mode === 'manual_review' &&
        tripRow.status === 'open' &&
        tripRow.payment_status === 'paid'
      ) {
        const { count } = await supabase
          .from('trip_offers')
          .select('id', { count: 'exact', head: true })
          .eq('trip_id', tripId)
          .eq('status', 'pending');
        setPendingOfferCount(count ?? 0);
      } else {
        setPendingOfferCount(0);
      }

      const driverInfo = await resolveDriverForTrip(tripRow);
      setDriver(driverInfo);

      if (tripRow.status === 'completed') {
        const review = await fetchRiderReviewForTrip(tripId, user.id);
        setExistingReview(review);
      } else {
        setExistingReview(null);
      }
    } catch (err: unknown) {
      setLoadState('error');
      setErrorMessage(err instanceof Error ? err.message : 'Failed to load trip');
      setTrip(null);
    }
  }, [tripId, resolveDriverForTrip]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const needsPayment = trip ? riderTripNeedsPayment(trip.payment_status, trip.status) : false;
  const paymentConfirming = paymentSuccess && needsPayment;

  const formatConfirmStatus = useCallback(
    (result: Awaited<ReturnType<typeof confirmRiderTripPayment>>) => {
      const parts = [
        result.sessionPaymentStatus ? `session: ${result.sessionPaymentStatus}` : null,
        result.sessionStatus ? `checkout: ${result.sessionStatus}` : null,
        result.paymentIntentStatus ? `intent: ${result.paymentIntentStatus}` : null,
        result.debug?.stripeMode ? `stripe: ${result.debug.stripeMode}` : null,
        result.debug?.reason ? `reason: ${result.debug.reason}` : null,
      ].filter(Boolean);
      return parts.join(' · ') || 'Waiting for Stripe confirmation…';
    },
    []
  );

  const confirmPaymentOnce = useCallback(async (): Promise<boolean> => {
    if (confirmInFlightRef.current) return false;
    confirmInFlightRef.current = true;

    try {
      const result = await confirmRiderTripPayment(tripId, checkoutSessionId);
      setLastConfirmStatus(formatConfirmStatus(result));
      await refresh();

      if (result.paid || result.alreadyPaid) {
        setPaymentConfirmTimedOut(false);
        setPaymentError('');
        return true;
      }

      if (result.debug?.updateError) {
        setPaymentError(`Database update failed: ${result.debug.updateError}`);
      } else if (result.sessionPaymentStatus && result.sessionPaymentStatus !== 'paid') {
        setPaymentError(
          `Stripe not paid yet (${result.sessionPaymentStatus}). Sandbox can take a few seconds — we will keep checking.`
        );
      }

      return false;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to confirm payment';
      console.error('confirmRiderTripPayment:', message);
      setPaymentError(message);
      setLastConfirmStatus(`Error: ${message}`);
      await refresh();
      return false;
    } finally {
      confirmInFlightRef.current = false;
    }
  }, [tripId, checkoutSessionId, refresh, formatConfirmStatus]);

  const handleRetryConfirmation = useCallback(async () => {
    setIsRetryingPayment(true);
    setPaymentConfirmTimedOut(false);
    setPaymentError('');
    confirmAttemptsRef.current = 0;
    setConfirmAttemptCount(0);
    pollGenerationRef.current += 1;

    try {
      const paid = await confirmPaymentOnce();
      if (!paid) {
        setPaymentError(
          'Payment not confirmed yet. Wait a few seconds and try again, or refresh the page.'
        );
      }
    } finally {
      setIsRetryingPayment(false);
    }
  }, [confirmPaymentOnce]);

  const handleRefreshPage = useCallback(() => {
    window.location.reload();
  }, []);

  // After Stripe redirect: verify with Stripe API (webhook fallback), poll until paid
  useEffect(() => {
    if (!paymentConfirming) return;

    const generation = pollGenerationRef.current + 1;
    pollGenerationRef.current = generation;

    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | undefined;
    let initialTimeoutId: ReturnType<typeof setTimeout> | undefined;

    confirmAttemptsRef.current = 0;
    setConfirmAttemptCount(0);
    setPaymentConfirmTimedOut(false);
    setPaymentError('');
    setLastConfirmStatus('Starting payment verification…');

    const tick = async () => {
      if (cancelled || pollGenerationRef.current !== generation) return;

      confirmAttemptsRef.current += 1;
      setConfirmAttemptCount(confirmAttemptsRef.current);

      const paid = await confirmPaymentOnce();

      if (cancelled || pollGenerationRef.current !== generation) return;

      if (paid) {
        if (intervalId) clearInterval(intervalId);
        return;
      }

      if (confirmAttemptsRef.current >= MAX_CONFIRM_ATTEMPTS) {
        setPaymentConfirmTimedOut(true);
        setPaymentError(
          `We could not confirm payment automatically. Contact support with Trip ID: ${tripId}`
        );
        if (intervalId) clearInterval(intervalId);
      }
    };

    initialTimeoutId = setTimeout(() => {
      void tick();
      intervalId = setInterval(() => {
        void tick();
      }, POLL_INTERVAL_MS);
    }, INITIAL_POLL_DELAY_MS);

    return () => {
      cancelled = true;
      if (initialTimeoutId) clearTimeout(initialTimeoutId);
      if (intervalId) clearInterval(intervalId);
    };
  }, [paymentConfirming, confirmPaymentOnce, tripId]);

  // Poll while matching or active so open → pending_assignment → assigned updates appear
  useEffect(() => {
    if (!trip || !shouldPollRiderTrip(trip)) return;

    const intervalMs = getTripPollIntervalMs(trip);
    console.log('[RiderTripDetail] starting status poll', {
      tripId,
      status: trip.status,
      matching_mode: trip.matching_mode,
      intervalMs,
    });

    const interval = setInterval(() => {
      void refresh();
    }, intervalMs);

    return () => clearInterval(interval);
  }, [trip?.status, trip?.matching_mode, trip?.payment_status, tripId, refresh]);

  // Refresh immediately when rider returns to tab during matching
  useEffect(() => {
    if (!trip || !shouldPollRiderTrip(trip)) return;

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        console.log('[RiderTripDetail] tab visible — refreshing trip', { tripId, status: trip.status });
        void refresh();
      }
    };

    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [trip?.status, trip?.matching_mode, trip?.payment_status, tripId, refresh]);

  // Buffer countdown for pending_assignment
  useEffect(() => {
    if (!trip?.assignment_expires_at || trip.status !== 'pending_assignment') {
      setBufferSecondsLeft(null);
      return;
    }

    const tick = () => {
      const left = Math.max(
        0,
        Math.ceil((new Date(trip.assignment_expires_at!).getTime() - Date.now()) / 1000)
      );
      setBufferSecondsLeft(left);
    };

    tick();
    const interval = setInterval(tick, 500);
    return () => clearInterval(interval);
  }, [trip?.assignment_expires_at, trip?.status]);

  const handleCompletePayment = async () => {
    if (!trip || !riderTripNeedsPayment(trip.payment_status, trip.status)) return;

    setPaying(true);
    setPaymentError('');

    try {
      const url = await startRiderTripCheckout(trip.id);
      window.location.href = url;
    } catch (err: unknown) {
      setPaymentError(err instanceof Error ? err.message : 'Failed to start checkout');
      setPaying(false);
    }
  };

  const handleCancelTrip = async () => {
    if (!trip) return;

    const cancellable = ['awaiting_payment', 'open', 'assigned'].includes(trip.status);
    if (!cancellable) return;

    const confirmed = window.confirm(
      'Cancel this trip? Refunds follow our cancel policy based on how close you are to pickup time.'
    );
    if (!confirmed) return;

    setCancelling(true);
    setActionMessage('');

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Please sign in again.');

      const { error: updateError } = await supabase
        .from('trips')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', trip.id)
        .eq('rider_id', user.id);

      if (updateError) throw updateError;

      setActionMessage('Trip cancelled. Refund processing will follow our cancel policy.');
      await refresh();
    } catch (err: unknown) {
      setActionMessage(err instanceof Error ? err.message : 'Failed to cancel trip');
    } finally {
      setCancelling(false);
    }
  };

  const mapCoords = useMemo(() => {
    if (!trip) return { pickup: null, dropoff: null, current: null };
    return {
      pickup:
        trip.start_lat != null && trip.start_lng != null
          ? { lat: Number(trip.start_lat), lng: Number(trip.start_lng) }
          : null,
      dropoff:
        trip.end_lat != null && trip.end_lng != null
          ? { lat: Number(trip.end_lat), lng: Number(trip.end_lng) }
          : null,
      current:
        trip.current_lat != null && trip.current_lng != null
          ? { lat: Number(trip.current_lat), lng: Number(trip.current_lng) }
          : null,
    };
  }, [trip]);

  const showLiveMap =
    trip != null && ['assigned', 'in_progress', 'completed'].includes(trip.status);
  const showDriverContact =
    trip != null && ['assigned', 'in_progress'].includes(trip.status);

  if (loadState === 'loading') {
    return <RiderLoadingSpinner message="Loading trip..." />;
  }

  if (loadState === 'unauthorized') {
    return (
      <TripAccessError
        title="Sign in required"
        message={errorMessage}
        onRetry={refresh}
      />
    );
  }

  if (loadState === 'not_found' || loadState === 'error' || !trip) {
    return (
      <TripAccessError
        title={loadState === 'not_found' ? 'Trip not found' : 'Could not load trip'}
        message={errorMessage}
        onRetry={refresh}
      />
    );
  }

  return (
    <div className="mx-auto max-w-2xl pb-8">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link href="/rider/trips" className="text-sm font-medium text-[#1E3A8A] hover:underline">
          ← My Trips
        </Link>
        <span className="text-blue-300">|</span>
        <Link href="/rider/dashboard" className="text-sm font-medium text-[#1E3A8A] hover:underline">
          Dashboard
        </Link>
      </div>

      {/* Flash messages */}
      {paymentSuccess && trip.payment_status === 'paid' && (
        <div className="mb-4 rounded-2xl border border-green-200 bg-green-50 px-5 py-4">
          <p className="font-semibold text-green-900">Payment successful</p>
          <p className="mt-1 text-sm text-green-800">Your ride request is confirmed and published to drivers.</p>
        </div>
      )}
      {paymentConfirming && (
        <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4">
          <div className="flex items-start gap-3">
            {!paymentConfirmTimedOut && (
              <span
                className="mt-0.5 inline-block h-5 w-5 animate-spin rounded-full border-2 border-blue-300 border-t-[#1E3A8A]"
                aria-hidden
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-blue-950">
                {paymentConfirmTimedOut ? 'Payment confirmation delayed' : 'Confirming your payment…'}
              </p>
              <p className="mt-1 text-sm text-blue-800">
                {paymentConfirmTimedOut
                  ? 'Your card may have been charged in Stripe test mode, but this trip is not marked paid yet.'
                  : 'Stripe checkout completed. Verifying with Stripe (sandbox-friendly) and updating your trip.'}
              </p>
              {confirmAttemptCount > 0 && (
                <p className="mt-2 text-xs text-blue-700">
                  Attempt {confirmAttemptCount} of {MAX_CONFIRM_ATTEMPTS}
                  {checkoutSessionId ? ` · session ${checkoutSessionId.slice(0, 24)}…` : ''}
                </p>
              )}
              {lastConfirmStatus && (
                <p className="mt-1 text-xs text-blue-600">{lastConfirmStatus}</p>
              )}
              <p className="mt-2 text-xs font-medium text-blue-900">
                Trip ID (for support): <span className="font-mono">{tripId}</span>
              </p>
              {paymentError && (
                <p className="mt-2 text-sm text-red-700">{paymentError}</p>
              )}
              {paymentConfirmTimedOut && (
                <p className="mt-2 text-sm text-blue-900">
                  Next steps: click <strong>Retry Confirmation</strong>, then <strong>Refresh Page</strong>.
                  If it still fails, email support with the Trip ID above and your checkout time.
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleRetryConfirmation}
                  disabled={isRetryingPayment}
                  className={`${riderPrimaryButtonClass} disabled:cursor-not-allowed disabled:opacity-70`}
                >
                  {isRetryingPayment ? 'Retrying confirmation…' : 'Retry Confirmation'}
                </button>
                <button
                  type="button"
                  onClick={handleRefreshPage}
                  className="rounded-xl border border-blue-200 bg-white px-5 py-2.5 text-sm font-semibold text-[#1E3A8A] hover:bg-blue-50"
                >
                  Refresh Page
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {needsPayment && !paymentConfirming && (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
          <p className="font-semibold text-amber-950">Payment pending</p>
          <p className="mt-1 text-sm text-amber-900">
            Finish payment to publish this ride request to drivers.
          </p>
          {paymentCancelled && (
            <p className="mt-2 text-sm text-amber-800">
              Checkout was cancelled. No charge was made — complete payment when you are ready.
            </p>
          )}
          <button
            type="button"
            onClick={handleCompletePayment}
            disabled={paying}
            className={`mt-4 ${riderPrimaryButtonClass} disabled:cursor-not-allowed disabled:opacity-70`}
          >
            {paying ? 'Redirecting to payment...' : 'Complete Payment'}
          </button>
          {paymentError && (
            <p className="mt-2 text-sm text-red-700">{paymentError}</p>
          )}
        </div>
      )}
      {assignedSuccess && trip.status === 'assigned' && (
        <div className="mb-4 rounded-2xl border border-green-200 bg-green-50 px-5 py-4">
          <p className="font-semibold text-green-900">Driver confirmed</p>
        </div>
      )}
      {declinedDriver && trip.status === 'open' && (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
          <p className="font-semibold text-amber-900">Driver declined — searching for new offers</p>
        </div>
      )}
      {actionMessage && (
        <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          {actionMessage}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-blue-950 sm:text-3xl">{trip.title}</h1>
          <p className="mt-1 text-sm text-blue-800">
            {trip.schedule_mode === 'asap'
              ? `Requested ${ASAP_EXPECTATIONS.title.toLowerCase()} · target ~${formatDateTime(trip.pickup_time)}`
              : `Scheduled ${formatDateTime(trip.pickup_time)}`}
          </p>
        </div>
        <TripStatusBadge status={trip.status} />
      </div>

      {/* Timeline */}
      <TripTimeline
        className="mt-6"
        status={trip.status}
        pickupTime={trip.pickup_time}
        variant="default"
        showTitle
      />

      {trip.schedule_mode === 'asap' &&
        trip.status !== 'cancelled' &&
        trip.status !== 'completed' &&
        ['awaiting_payment', 'open', 'assigned'].includes(trip.status) && (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
            <p className="font-semibold text-amber-950">As soon as possible — matching in progress</p>
            <p className="mt-2 text-sm text-amber-900">
              We do not guarantee immediate pickup. Independent contractor drivers in your area can
              accept this trip; the closest available driver will be assigned as soon as possible.
            </p>
            <p className="mt-2 text-xs text-amber-800">
              Immediate requests may take longer during busy periods. {CONTRACTOR_DISCLAIMER}
            </p>
          </div>
        )}

      {/* Status-specific hero */}
      {trip.status === 'open' && trip.payment_status === 'paid' && (
        <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-5">
          <h2 className="font-semibold text-blue-950">
            {trip.matching_mode === 'manual_review' ? 'Awaiting driver offers' : 'Looking for a driver'}
          </h2>
          <p className="mt-2 text-sm text-blue-800">
            {trip.matching_mode === 'manual_review'
              ? pendingOfferCount > 0
                ? `${pendingOfferCount} driver offer${pendingOfferCount === 1 ? '' : 's'} ready for your review.`
                : 'Drivers are submitting offers. You will choose your preferred driver.'
              : 'Your trip is live. The first available driver will be matched automatically.'}
          </p>
          {trip.matching_mode === 'manual_review' && (
            <Link
              href={`/rider/trips/${tripId}/offers`}
              className={`mt-4 ${riderPrimaryButtonClass}`}
            >
              {pendingOfferCount > 0
                ? `Review Offers (${pendingOfferCount})`
                : 'View Offers'}
            </Link>
          )}
        </div>
      )}

      {trip.status === 'pending_assignment' && trip.matching_mode === 'auto_first_offer' && (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="font-semibold text-amber-950">Review your matched driver</h2>
          <p className="mt-2 text-sm text-amber-900">
            A driver has been found. You have{' '}
            <strong>{bufferSecondsLeft ?? '—'} seconds</strong> to review or decline before auto-confirmation.
          </p>
          <Link
            href={`/rider/trips/${tripId}/pending`}
            className="mt-4 inline-flex rounded-xl bg-[#1E3A8A] px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-900"
          >
            Review driver now
          </Link>
        </div>
      )}

      {trip.status === 'assigned' && (
        <div className="mt-4 rounded-2xl border border-green-200 bg-green-50 p-5">
          <h2 className="font-semibold text-green-950">Driver confirmed</h2>
          <p className="mt-2 text-sm text-green-900">
            Pickup scheduled for <strong>{formatDateTime(trip.pickup_time)}</strong>. Your driver will head to the
            pickup location at the scheduled time.
          </p>
        </div>
      )}

      {trip.status === 'in_progress' && (
        <div className="mt-4 rounded-2xl border border-blue-300 bg-gradient-to-r from-blue-50 to-blue-100 p-5">
          <h2 className="font-semibold text-blue-950">Driver is on the way</h2>
          <p className="mt-2 text-sm text-blue-900">
            Your trip is in progress
            {trip.started_at ? ` · Started ${formatDateTime(trip.started_at)}` : ''}.
          </p>
          {trip.last_location_update && (
            <p className="mt-1 text-xs text-blue-700">
              Last location update: {formatDateTime(trip.last_location_update)}
            </p>
          )}
          <a href="#live-map" className={`mt-4 ${riderPrimaryButtonClass}`}>
            Track live
          </a>
        </div>
      )}

      {trip.status === 'completed' && (
        <div className="mt-4 rounded-2xl border border-purple-200 bg-purple-50 p-5">
          <h2 className="font-semibold text-purple-950">Trip completed</h2>
          <p className="mt-2 text-sm text-purple-900">
            Thank you for riding with Safe Ride Network
            {trip.ended_at ? ` · Ended ${formatDateTime(trip.ended_at)}` : ''}.
          </p>
        </div>
      )}

      {trip.status === 'cancelled' && (
        <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-5">
          <h2 className="font-semibold text-gray-900">Trip cancelled</h2>
          <p className="mt-2 text-sm text-gray-700">
            This trip was cancelled. If you paid in advance, refunds are processed per our cancel &amp; refund policy
            (typically 5–10 business days).
          </p>
          <p className="mt-2 text-xs text-gray-600">
            Refund status: {trip.payment_status === 'paid' ? 'Eligible — processing' : 'N/A'}
          </p>
        </div>
      )}

      {/* Driver card */}
      {driver && ['pending_assignment', 'assigned', 'in_progress', 'completed'].includes(trip.status) && (
        <div className="mt-4">
          <DriverCard driver={driver} showContact={showDriverContact} />
        </div>
      )}

      {/* Map */}
      <div className="mt-4 rounded-2xl border border-blue-200 bg-white p-4 shadow-sm sm:p-5" id="live-map">
        <h2 className="mb-3 text-lg font-semibold text-blue-950">
          {trip.status === 'in_progress' ? 'Live tracking' : 'Route'}
        </h2>
        {showLiveMap || trip.status === 'open' || trip.status === 'pending_assignment' ? (
          <TripMap
            pickup={trip.pickup_location}
            dropoff={trip.dropoff_location}
            pickupCoords={mapCoords.pickup}
            dropoffCoords={mapCoords.dropoff}
            currentLocation={trip.status === 'in_progress' ? mapCoords.current : null}
            currentLocationLabel="Driver"
            height={260}
            showLegend={trip.status === 'in_progress'}
          />
        ) : (
          <div className="rounded-xl border border-dashed border-blue-200 bg-blue-50/50 px-4 py-8 text-center text-sm text-blue-800">
            Map preview will appear once your trip is underway.
          </div>
        )}
      </div>

      {/* Trip details */}
      <div className="mt-4 rounded-2xl border border-blue-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-blue-950">Trip details</h2>
        <dl className="mt-4 space-y-3 text-sm">
          <div>
            <dt className="font-medium text-blue-900">Pickup</dt>
            <dd className="text-blue-800">{trip.pickup_location}</dd>
          </div>
          <div>
            <dt className="font-medium text-blue-900">Drop-off</dt>
            <dd className="text-blue-800">{trip.dropoff_location}</dd>
          </div>
          <div>
            <dt className="font-medium text-blue-900">Passengers</dt>
            <dd className="text-blue-800">{trip.passengers ?? 1}</dd>
          </div>
          {trip.description && (
            <div>
              <dt className="font-medium text-blue-900">Special requests</dt>
              <dd className="whitespace-pre-wrap text-blue-800">{trip.description}</dd>
            </div>
          )}
        </dl>
      </div>

      <div className="mt-4">
        <PriceBreakdownCard trip={trip} />
      </div>

      {/* Completed: rate driver */}
      {trip.status === 'completed' && trip.assigned_driver_id && (
        <DriverRatingForm
          className="mt-4"
          tripId={trip.id}
          driverId={trip.assigned_driver_id}
          driverName={driver?.full_name}
          existingReview={existingReview}
          onSubmitted={setExistingReview}
        />
      )}

      {/* Actions */}
      <div className="mt-6 flex flex-wrap gap-3">
        {['assigned', 'in_progress'].includes(trip.status) && (
          <a href="#live-map" className={riderPrimaryButtonClass}>
            Track live
          </a>
        )}

        {trip.status === 'pending_assignment' && trip.matching_mode === 'auto_first_offer' && (
          <Link href={`/rider/trips/${tripId}/pending`} className={riderPrimaryButtonClass}>
            Confirm or decline driver
          </Link>
        )}

        {trip.status === 'open' &&
          trip.payment_status === 'paid' &&
          trip.matching_mode === 'manual_review' && (
            <Link href={`/rider/trips/${tripId}/offers`} className={riderPrimaryButtonClass}>
              {pendingOfferCount > 0
                ? `Review Offers (${pendingOfferCount})`
                : 'Review Offers'}
            </Link>
          )}

        {['awaiting_payment', 'open', 'assigned'].includes(trip.status) && (
          <button
            type="button"
            onClick={handleCancelTrip}
            disabled={cancelling}
            className={riderDangerButtonClass}
          >
            {cancelling ? 'Cancelling...' : 'Cancel trip'}
          </button>
        )}
      </div>
    </div>
  );
}

export default function RiderTripDetailPage() {
  return (
    <Suspense fallback={<RiderLoadingSpinner message="Loading trip..." />}>
      <RiderTripDetailContent />
    </Suspense>
  );
}