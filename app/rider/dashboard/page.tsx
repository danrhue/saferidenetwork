'use client';

/**
 * Rider dashboard — hero trip status, upcoming rides, matching preference, recent activity.
 * Phase 2: Supabase Realtime for live hero updates; unread badge on hero card.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import TripStatusBadge from '@/components/rider/TripStatusBadge';
import RiderLoadingSpinner from '@/components/rider/RiderLoadingSpinner';
import RiderTrustBanner from '@/components/rider/RiderTrustBanner';
import { formatPickupTime, routeSummary } from '@/lib/rider/format';
import { riderPrimaryButtonClass } from '@/lib/rider/ui';

const UPCOMING_STATUSES = ['open', 'pending_assignment', 'assigned'] as const;
const HERO_STATUSES = ['in_progress', 'pending_assignment', 'assigned'] as const;

type RiderTrip = {
  id: string;
  title: string;
  pickup_location: string;
  dropoff_location: string;
  pickup_time: string;
  passengers: number | null;
  status: string;
  assigned_driver_id: string | null;
  created_at: string;
  driver_name?: string | null;
};

type DashboardData = {
  riderName: string | null;
  matchingMode: string | null;
  heroTrip: RiderTrip | null;
  upcomingTrips: RiderTrip[];
  recentCompleted: RiderTrip | null;
};

const MATCHING_LABELS: Record<string, { title: string; description: string }> = {
  auto_first_offer: {
    title: 'Auto-match first driver',
    description: 'First available driver is assigned with a 60-second confirmation window.',
  },
  manual_review: {
    title: 'Review offers manually',
    description: 'You choose the driver from offers submitted for your trip.',
  },
};

function tripRouteSummary(trip: RiderTrip): string {
  return routeSummary(trip.pickup_location, trip.dropoff_location);
}

function pickHeroTrip(trips: RiderTrip[]): RiderTrip | null {
  for (const status of HERO_STATUSES) {
    const match = trips.find((t) => t.status === status);
    if (match) return match;
  }
  return null;
}

async function attachDriverNames(trips: RiderTrip[]): Promise<RiderTrip[]> {
  const driverIds = [...new Set(trips.map((t) => t.assigned_driver_id).filter(Boolean))] as string[];
  if (driverIds.length === 0) return trips;

  const { data: drivers } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('id', driverIds);

  const nameMap = Object.fromEntries(
    (drivers ?? []).map((d) => [d.id, d.full_name || 'Your driver'])
  );

  return trips.map((trip) => ({
    ...trip,
    driver_name: trip.assigned_driver_id ? nameMap[trip.assigned_driver_id] ?? null : null,
  }));
}

function heroCta(trip: RiderTrip): { href: string; label: string } {
  if (trip.status === 'pending_assignment') {
    return { href: `/rider/trips/${trip.id}/pending`, label: 'Confirm Driver' };
  }
  if (trip.status === 'in_progress') {
    return { href: `/rider/trips/${trip.id}`, label: 'Track Trip' };
  }
  return { href: `/rider/trips/${trip.id}`, label: 'View Details' };
}

function UpcomingTripCard({ trip }: { trip: RiderTrip }) {
  return (
    <Link
      href={`/rider/trips/${trip.id}`}
      className="block rounded-2xl border border-blue-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-blue-950">{formatPickupTime(trip.pickup_time)}</p>
          <p className="mt-1 text-sm text-blue-800">{tripRouteSummary(trip)}</p>
        </div>
        <TripStatusBadge status={trip.status} />
      </div>
      {trip.driver_name && (
        <p className="mt-3 text-xs text-blue-700">
          Driver: <span className="font-medium text-blue-900">{trip.driver_name}</span>
        </p>
      )}
    </Link>
  );
}

export default function RiderDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError('Please sign in to view your dashboard.');
        setData(null);
        return;
      }

      const nowIso = new Date().toISOString();

      const [profileRes, upcomingRes, activeRes, completedRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('full_name, default_matching_mode')
          .eq('id', user.id)
          .single(),
        supabase
          .from('trips')
          .select(
            'id, title, pickup_location, dropoff_location, pickup_time, passengers, status, assigned_driver_id, created_at'
          )
          .eq('rider_id', user.id)
          .in('status', [...UPCOMING_STATUSES])
          .gt('pickup_time', nowIso)
          .order('pickup_time', { ascending: true })
          .limit(5),
        supabase
          .from('trips')
          .select(
            'id, title, pickup_location, dropoff_location, pickup_time, passengers, status, assigned_driver_id, created_at'
          )
          .eq('rider_id', user.id)
          .eq('status', 'in_progress')
          .order('pickup_time', { ascending: true })
          .limit(1),
        supabase
          .from('trips')
          .select(
            'id, title, pickup_location, dropoff_location, pickup_time, passengers, status, assigned_driver_id, created_at'
          )
          .eq('rider_id', user.id)
          .eq('status', 'completed')
          .order('created_at', { ascending: false })
          .limit(1),
      ]);

      if (profileRes.error) {
        console.error('Profile fetch error:', profileRes.error);
      }
      if (upcomingRes.error) throw new Error(upcomingRes.error.message);
      if (activeRes.error) throw new Error(activeRes.error.message);
      if (completedRes.error) throw new Error(completedRes.error.message);

      const upcomingRaw = upcomingRes.data ?? [];
      const activeRaw = activeRes.data ?? [];
      const completedRaw = completedRes.data ?? [];

      const allForDrivers = [...upcomingRaw, ...activeRaw, ...completedRaw] as RiderTrip[];
      const withDrivers = await attachDriverNames(allForDrivers);

      const byId = Object.fromEntries(withDrivers.map((t) => [t.id, t]));
      const upcoming = upcomingRaw.map((t) => byId[t.id]);
      const active = activeRaw.map((t) => byId[t.id]);
      const recentCompleted = completedRaw[0] ? byId[completedRaw[0].id] : null;

      const heroCandidates = [...active, ...upcoming.filter((t) => HERO_STATUSES.includes(t.status as (typeof HERO_STATUSES)[number]))];
      const heroTrip = pickHeroTrip(heroCandidates);

      const upcomingTrips = upcoming
        .filter((t) => t.id !== heroTrip?.id)
        .slice(0, 2);

      setData({
        riderName: profileRes.data?.full_name ?? null,
        matchingMode: profileRes.data?.default_matching_mode ?? 'auto_first_offer',
        heroTrip,
        upcomingTrips,
        recentCompleted,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const matchingInfo = useMemo(() => {
    const mode = data?.matchingMode ?? 'auto_first_offer';
    return MATCHING_LABELS[mode] ?? MATCHING_LABELS.auto_first_offer;
  }, [data?.matchingMode]);

  const greeting = data?.riderName ? `Welcome back, ${data.riderName.split(' ')[0]}` : 'Welcome to your Rider Portal';

  if (loading) {
    return <RiderLoadingSpinner message="Loading your dashboard..." className="mx-auto max-w-4xl" />;
  }

  if (error) {
    return (
      <div className="mx-auto max-w-4xl rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-sm text-red-700">{error}</p>
        <button
          type="button"
          onClick={fetchDashboard}
          className="mt-4 text-sm font-medium text-[#1E3A8A] hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  const hero = data?.heroTrip ?? null;

  return (
    <div className="mx-auto max-w-4xl">
      {/* Status hero or welcome */}
      {hero ? (
        <div className="mb-6 rounded-2xl border border-blue-200 bg-gradient-to-br from-[#1E3A8A] to-blue-800 p-6 text-white shadow-sm sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium text-blue-100">
                {hero.status === 'in_progress' ? 'Trip in progress' : 'Your upcoming ride'}
              </p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{tripRouteSummary(hero)}</h1>
              <p className="mt-2 text-sm text-blue-100">{formatPickupTime(hero.pickup_time)}</p>
              {hero.driver_name && (
                <p className="mt-2 text-sm text-blue-50">
                  Driver: <span className="font-semibold">{hero.driver_name}</span>
                </p>
              )}
              <div className="mt-3">
                <TripStatusBadge status={hero.status} />
              </div>
            </div>
            <Link
              href={heroCta(hero).href}
              className="inline-flex shrink-0 items-center justify-center rounded-xl bg-white px-6 py-3 text-sm font-semibold text-[#1E3A8A] transition hover:bg-blue-50"
            >
              {heroCta(hero).label}
            </Link>
          </div>
        </div>
      ) : (
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-blue-950">{greeting}</h1>
          <p className="mt-2 text-blue-800">
            Request personal transportation, get matched with vetted drivers, and track your trips in one place.
          </p>
        </div>
      )}

      <RiderTrustBanner className="mb-6" />

      {/* Primary CTA + quick actions */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-[#1E3A8A] to-blue-800 p-6 text-white shadow-sm sm:col-span-2 sm:flex sm:items-center sm:justify-between sm:p-8">
          <div>
            <h2 className="text-xl font-semibold">Need a ride?</h2>
            <p className="mt-2 max-w-xl text-sm text-blue-100">
              Start a new trip request in minutes. You&apos;ll review pricing and policy before payment.
            </p>
          </div>
          <Link
            href="/rider/trips/new"
            className="mt-5 inline-flex rounded-xl bg-white px-6 py-3 text-sm font-semibold text-[#1E3A8A] transition hover:bg-blue-50 sm:mt-0 sm:shrink-0"
          >
            Request a Ride
          </Link>
        </div>

        <Link
          href="/rider/trips"
          className="rounded-2xl border border-blue-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow-md"
        >
          <h2 className="font-semibold text-blue-950">My Trips</h2>
          <p className="mt-1 text-sm text-blue-800">View upcoming, active, and past rides</p>
        </Link>

        <Link
          href="/rider/profile"
          className="rounded-2xl border border-blue-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow-md"
        >
          <h2 className="font-semibold text-blue-950">My Profile</h2>
          <p className="mt-1 text-sm text-blue-800">Update contact and accessibility info</p>
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Matching preference */}
        <div className="rounded-2xl border border-blue-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-blue-950">Matching preference</h2>
          <p className="mt-2 text-sm text-blue-800">How we connect you with drivers on new requests.</p>
          <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
            <p className="text-sm font-medium text-blue-950">{matchingInfo.title}</p>
            <p className="mt-1 text-xs text-blue-700">{matchingInfo.description}</p>
          </div>
          <Link
            href="/rider/settings/matching"
            className="mt-4 inline-block text-sm font-medium text-[#1E3A8A] hover:underline"
          >
            Change matching settings →
          </Link>
        </div>

        {/* Upcoming trips */}
        <div className="rounded-2xl border border-blue-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-blue-950">Upcoming trips</h2>
            <Link href="/rider/trips" className="text-sm font-medium text-[#1E3A8A] hover:underline">
              View all
            </Link>
          </div>

          {data?.upcomingTrips && data.upcomingTrips.length > 0 ? (
            <ul className="mt-4 space-y-3">
              {data.upcomingTrips.map((trip) => (
                <li key={trip.id}>
                  <UpcomingTripCard trip={trip} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-blue-200 bg-blue-50/50 px-4 py-6 text-center">
              <p className="text-sm text-blue-800">No other upcoming trips scheduled.</p>
              <Link
                href="/rider/trips/new"
                className="mt-3 inline-flex text-sm font-semibold text-[#1E3A8A] hover:underline"
              >
                Request a ride
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Recent completed trip */}
      {data?.recentCompleted && (
        <div className="mt-6 rounded-2xl border border-blue-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-blue-950">Recent activity</h2>
          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium text-blue-950">{tripRouteSummary(data.recentCompleted)}</p>
              <p className="mt-1 text-sm text-blue-800">
                Completed {formatPickupTime(data.recentCompleted.pickup_time)}
              </p>
              {data.recentCompleted.driver_name && (
                <p className="mt-1 text-xs text-blue-700">
                  Driver: {data.recentCompleted.driver_name}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href={`/rider/trips/${data.recentCompleted.id}`}
                className="inline-flex rounded-xl border border-blue-200 px-4 py-2 text-sm font-medium text-blue-950 transition hover:bg-blue-50"
              >
                View trip
              </Link>
              <Link
                href={`/rider/trips/${data.recentCompleted.id}`}
                className={riderPrimaryButtonClass}
              >
                Rate your driver
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}