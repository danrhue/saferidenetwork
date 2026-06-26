'use client';

/**
 * My Trips — tabbed list (Upcoming, Active, Completed, Cancelled).
 * Phase 2: Realtime status updates, pagination, search/filters.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import TripStatusBadge from '@/components/rider/TripStatusBadge';
import RiderBackLink from '@/components/rider/RiderBackLink';
import RiderLoadingSpinner from '@/components/rider/RiderLoadingSpinner';
import RiderEmptyState from '@/components/rider/RiderEmptyState';
import { riderTripNeedsPayment, startRiderTripCheckout } from '@/lib/rider/checkout';
import { formatPickupTime, truncateLocation } from '@/lib/rider/format';
import { riderPrimaryButtonClass } from '@/lib/rider/ui';

const TABS = ['Upcoming', 'Active', 'Completed', 'Cancelled'] as const;
type TripTab = (typeof TABS)[number];

const UPCOMING_STATUSES = ['open', 'pending_assignment', 'assigned'] as const;

type RiderTrip = {
  id: string;
  title: string;
  pickup_location: string;
  dropoff_location: string;
  pickup_time: string;
  passengers: number | null;
  status: string;
  payment_status: string | null;
  assigned_driver_id: string | null;
  created_at: string;
  driver_name?: string | null;
};

const EMPTY_MESSAGES: Record<TripTab, string> = {
  Upcoming: 'No upcoming trips scheduled. Request a ride to get started.',
  Active: 'No active trips right now. When your driver is en route, your trip will show here.',
  Completed: 'No completed trips yet. Your trip history will appear here after your first ride.',
  Cancelled: 'No cancelled trips. Any cancelled requests will be listed here for your records.',
};

function filterTripsForTab(trips: RiderTrip[], tab: TripTab): RiderTrip[] {
  const now = Date.now();

  switch (tab) {
    case 'Upcoming':
      return trips.filter(
        (t) =>
          (UPCOMING_STATUSES as readonly string[]).includes(t.status) &&
          new Date(t.pickup_time).getTime() > now
      );
    case 'Active':
      return trips.filter((t) => t.status === 'in_progress');
    case 'Completed':
      return trips.filter((t) => t.status === 'completed');
    case 'Cancelled':
      return trips.filter((t) => t.status === 'cancelled');
    default:
      return [];
  }
}

function RequestRideButton({ className = '' }: { className?: string }) {
  return (
    <Link
      href="/rider/trips/new"
      className={`${riderPrimaryButtonClass} ${className}`}
    >
      Request a Ride
    </Link>
  );
}

function TripCard({
  trip,
  payingTripId,
  onCompletePayment,
}: {
  trip: RiderTrip;
  payingTripId: string | null;
  onCompletePayment: (tripId: string) => void;
}) {
  const detailHref = `/rider/trips/${encodeURIComponent(trip.id)}`;
  const needsPayment = riderTripNeedsPayment(trip.payment_status, trip.status);
  const isPaying = payingTripId === trip.id;

  return (
    <div className="rounded-2xl border border-blue-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow-md sm:p-6">
      <Link href={detailHref} className="block">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-semibold text-blue-950">{trip.title}</h3>
            <p className="mt-1 text-sm text-blue-800">{formatPickupTime(trip.pickup_time)}</p>
          </div>
          <TripStatusBadge status={trip.status} />
        </div>

        <dl className="mt-4 space-y-2 text-sm">
          <div>
            <dt className="font-medium text-blue-900">Pickup</dt>
            <dd className="text-blue-800">{truncateLocation(trip.pickup_location)}</dd>
          </div>
          <div>
            <dt className="font-medium text-blue-900">Drop-off</dt>
            <dd className="text-blue-800">{truncateLocation(trip.dropoff_location)}</dd>
          </div>
        </dl>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-blue-800">
          <span>
            {trip.passengers ?? 1} passenger{(trip.passengers ?? 1) === 1 ? '' : 's'}
          </span>
          {trip.driver_name && (
            <span>
              Driver: <span className="font-medium text-blue-950">{trip.driver_name}</span>
            </span>
          )}
        </div>
      </Link>

      {needsPayment && (
        <div className="mt-4 border-t border-amber-100 pt-4">
          <p className="text-sm text-amber-900">Payment pending — finish checkout to publish to drivers.</p>
          <button
            type="button"
            onClick={() => onCompletePayment(trip.id)}
            disabled={isPaying}
            className={`mt-3 ${riderPrimaryButtonClass} disabled:cursor-not-allowed disabled:opacity-70`}
          >
            {isPaying ? 'Redirecting...' : 'Complete Payment'}
          </button>
        </div>
      )}
    </div>
  );
}

export default function RiderTripsPage() {
  const [activeTab, setActiveTab] = useState<TripTab>('Upcoming');
  const [trips, setTrips] = useState<RiderTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [payingTripId, setPayingTripId] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState('');

  const fetchTrips = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setTrips([]);
        setError('Please sign in to view your trips.');
        return;
      }

      const { data: tripsData, error: tripsError } = await supabase
        .from('trips')
        .select(
          'id, title, pickup_location, dropoff_location, pickup_time, passengers, status, payment_status, assigned_driver_id, created_at, rider_id'
        )
        .eq('rider_id', user.id)
        .not('rider_id', 'is', null)
        .order('created_at', { ascending: false });

      if (tripsError) {
        throw new Error(tripsError.message);
      }

      const rows = tripsData ?? [];
      const driverIds = [
        ...new Set(rows.map((t) => t.assigned_driver_id).filter(Boolean)),
      ] as string[];

      let driverNameMap: Record<string, string> = {};

      if (driverIds.length > 0) {
        const { data: drivers, error: driversError } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', driverIds);

        if (driversError) {
          console.error('Driver profile fetch error:', driversError);
        } else {
          driverNameMap = Object.fromEntries(
            (drivers ?? []).map((d) => [d.id, d.full_name || 'Assigned driver'])
          );
        }
      }

      const enriched: RiderTrip[] = rows.map((trip) => ({
        ...trip,
        driver_name: trip.assigned_driver_id
          ? driverNameMap[trip.assigned_driver_id] ?? null
          : null,
      }));

      setTrips(enriched);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load trips';
      setError(message);
      setTrips([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrips();
  }, [fetchTrips]);

  const filteredTrips = useMemo(
    () => filterTripsForTab(trips, activeTab),
    [trips, activeTab]
  );

  const handleCompletePayment = useCallback(async (tripId: string) => {
    setPayingTripId(tripId);
    setPaymentError('');

    try {
      const url = await startRiderTripCheckout(tripId);
      window.location.href = url;
    } catch (err: unknown) {
      setPaymentError(err instanceof Error ? err.message : 'Failed to start checkout');
      setPayingTripId(null);
    }
  }, []);

  const tabCounts = useMemo(
    () =>
      Object.fromEntries(TABS.map((tab) => [tab, filterTripsForTab(trips, tab).length])) as Record<
        TripTab,
        number
      >,
    [trips]
  );

  return (
    <div className="mx-auto max-w-4xl">
      <RiderBackLink href="/rider/dashboard" label="Back to dashboard" />

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-blue-950">My Trips</h1>
          <p className="mt-1 text-blue-800">View and manage your ride requests.</p>
        </div>
        <RequestRideButton className="shrink-0" />
      </div>

      <div className="mb-6 flex flex-wrap gap-2 border-b border-blue-100 pb-4">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            aria-pressed={activeTab === tab}
            className={`min-h-[44px] rounded-xl px-4 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A8A] ${
              activeTab === tab
                ? 'bg-[#1E3A8A] text-white'
                : 'bg-white text-blue-900 ring-1 ring-blue-200 hover:bg-blue-50'
            }`}
          >
            {tab}
            {tabCounts[tab] > 0 && (
              <span
                className={`ml-1.5 rounded-full px-1.5 py-0.5 text-xs ${
                  activeTab === tab ? 'bg-white/20' : 'bg-blue-100 text-blue-800'
                }`}
              >
                {tabCounts[tab]}
              </span>
            )}
          </button>
        ))}
      </div>

      {paymentError && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {paymentError}
        </div>
      )}

      {loading ? (
        <RiderLoadingSpinner message="Loading your trips..." />
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm text-red-700">{error}</p>
          <button
            type="button"
            onClick={fetchTrips}
            className="mt-4 text-sm font-medium text-[#1E3A8A] hover:underline"
          >
            Try again
          </button>
        </div>
      ) : filteredTrips.length === 0 ? (
        <RiderEmptyState
          title={`No ${activeTab.toLowerCase()} trips`}
          description={EMPTY_MESSAGES[activeTab]}
          actionLabel="Request a Ride"
          actionHref="/rider/trips/new"
        />
      ) : (
        <ul className="space-y-4">
          {filteredTrips.map((trip) => (
            <li key={trip.id}>
              <TripCard
                trip={trip}
                payingTripId={payingTripId}
                onCompletePayment={handleCompletePayment}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}