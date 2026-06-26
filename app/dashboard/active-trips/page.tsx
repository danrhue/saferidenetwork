'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import ActiveTripCard from '@/components/driver/ActiveTripCard';
import { fetchDriverAssignedTrips, type DriverAssignedTrip } from '@/lib/driver/driver-trip-lists';
import { getErrorMessage } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

export default function DriverActiveTripsPage() {
  const [trips, setTrips] = useState<DriverAssignedTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError('Please sign in to view your active trips.');
        setTrips([]);
        return;
      }

      const assigned = await fetchDriverAssignedTrips(supabase, user.id);
      setTrips(assigned);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
      setTrips([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="mb-4 h-10 w-10 animate-spin rounded-full border-2 border-[#1E3A8A] border-t-transparent" />
        <p className="font-medium text-blue-950">Loading active trips...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl pb-12">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-blue-950">Active Trips</h1>
          <p className="mt-1 text-blue-800">
            Trips you have been assigned to. Open a trip to start navigation and manage your route.
          </p>
        </div>
        <Link
          href="/dashboard/trips"
          className="inline-flex items-center justify-center rounded-xl bg-[#1E3A8A] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-900"
        >
          Browse Available Trips
        </Link>
      </div>

      {error && (
        <div className="mb-6 flex items-start justify-between gap-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void fetchData()}
            className="shrink-0 text-sm font-medium text-red-800 hover:underline"
          >
            Retry
          </button>
        </div>
      )}

      {trips.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center shadow-sm">
          <div className="mb-3 text-4xl">🗺️</div>
          <h2 className="mb-2 text-xl font-semibold text-blue-950">No active trips right now</h2>
          <p className="mx-auto max-w-md text-blue-800">
            When an organization assigns you to a trip, it will appear here. You can submit offers
            on open trips from Browse Trips or track pending offers under My Offers.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/dashboard/my-offers"
              className="rounded-xl border border-blue-200 px-6 py-2.5 text-sm font-medium text-[#1E3A8A] transition hover:bg-blue-50"
            >
              View My Offers
            </Link>
            <Link
              href="/dashboard/trips"
              className="rounded-xl bg-[#1E3A8A] px-6 py-2.5 text-sm font-medium text-white transition hover:bg-blue-900"
            >
              Browse Trips
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {trips.map((trip) => (
            <ActiveTripCard key={trip.id} trip={trip} />
          ))}
        </div>
      )}
    </div>
  );
}