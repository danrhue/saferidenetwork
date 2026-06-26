'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import TripMap from '../../../components/TripMap';

interface Trip {
  id: string;
  title: string;
  description: string | null;
  pickup_location: string;
  dropoff_location: string;
  pickup_time: string;
  status: string;
  passengers: number | null;
  assigned_driver_id: string | null;
  current_lat: number | null;
  current_lng: number | null;
  last_location_update: string | null;
  started_at: string | null;
  organization_id: string;
}

export default function OrganizationLiveTripMap() {
  const params = useParams<{ tripId: string }>();
  const tripId = params.tripId;

  const [trip, setTrip] = useState<Trip | null>(null);
  const [driverName, setDriverName] = useState<string>('Unknown Driver');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdateDisplay, setLastUpdateDisplay] = useState<string>('');

  // Simple relative time formatter (updates live)
  const getRelativeTime = (iso: string | null): string => {
    if (!iso) return 'No updates yet';
    const then = new Date(iso).getTime();
    const now = Date.now();
    const diffMs = now - then;
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 30) return 'Just now';
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} min ago`;
    const diffH = Math.floor(diffMin / 60);
    return `${diffH}h ${diffMin % 60}m ago`;
  };

  const fetchTrip = async () => {
    setLoading(true);
    setError(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError('Not authenticated.');
      setLoading(false);
      return;
    }

    const { data, error: fetchError } = await supabase
      .from('trips')
      .select('*')
      .eq('id', tripId)
      .single();

    if (fetchError || !data) {
      setError('Trip not found.');
      setLoading(false);
      return;
    }

    const t = data as Trip;

    // Role protection: must be the owning organization
    if (t.organization_id !== user.id) {
      setError('You do not have permission to view this trip.');
      setLoading(false);
      return;
    }

    setTrip(t);

    // Fetch driver name if assigned
    if (t.assigned_driver_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', t.assigned_driver_id)
        .single();
      setDriverName(profile?.full_name || 'Unknown Driver');
    }

    setLoading(false);
  };

  // Realtime subscription for this trip's location updates
  useEffect(() => {
    if (!tripId) return;

    const channel = supabase
      .channel(`org-trip-live-${tripId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'trips',
          filter: `id=eq.${tripId}`,
        },
        (payload) => {
          const updated = payload.new as any;
          setTrip((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              status: updated.status ?? prev.status,
              current_lat: updated.current_lat ?? prev.current_lat,
              current_lng: updated.current_lng ?? prev.current_lng,
              last_location_update: updated.last_location_update ?? prev.last_location_update,
              started_at: updated.started_at ?? prev.started_at,
            };
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tripId]);

  // Refresh relative time display every 15 seconds for nice UX
  useEffect(() => {
    const updateDisplay = () => {
      if (trip) {
        setLastUpdateDisplay(getRelativeTime(trip.last_location_update));
      }
    };
    updateDisplay();
    const interval = setInterval(updateDisplay, 15000);
    return () => clearInterval(interval);
  }, [trip?.last_location_update]);

  useEffect(() => {
    if (tripId) {
      fetchTrip();
    }
  }, [tripId]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-8">
        <div className="text-center text-blue-800">Loading live trip data...</div>
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="max-w-md mx-auto mt-10 p-8 bg-white border border-gray-200 rounded-2xl text-center">
        <div className="text-5xl mb-4">🚫</div>
        <h2 className="text-2xl font-semibold text-blue-950 mb-2">Access Restricted</h2>
        <p className="text-blue-800 mb-6">{error || 'This trip is not available.'}</p>
        <Link href="/organization/active-trips" className="inline-block px-8 py-3 bg-[#1E3A8A] text-white rounded-2xl text-lg font-medium">
          Back to Active Trips
        </Link>
      </div>
    );
  }

  const isInProgress = trip.status === 'in_progress';
  const hasLiveLocation = trip.current_lat != null && trip.current_lng != null;

  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(trip.pickup_location)}&destination=${encodeURIComponent(trip.dropoff_location)}&travelmode=driving`;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link href="/organization/active-trips" className="text-sm text-blue-900 hover:underline">← Back to Active Trips</Link>
        <div className="flex items-center gap-3 mt-2">
          <h1 className="text-3xl font-bold text-blue-950">Live Driver Tracking</h1>
          {isInProgress && (
            <span className="px-3 py-1 text-sm font-semibold bg-blue-100 text-blue-800 rounded-full flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-blue-600 animate-pulse" /> LIVE
            </span>
          )}
        </div>
        <p className="text-blue-800 mt-1">Real-time location updates from the driver’s phone.</p>
      </div>

      {/* Trip Summary Card */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <div className="text-2xl font-semibold text-blue-950">{trip.title}</div>
            <div className="mt-1 text-xl text-blue-900">
              {trip.pickup_location} <span className="text-[#1E3A8A]">→</span> {trip.dropoff_location}
            </div>
            <div className="mt-3 text-sm grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1 text-blue-800">
              <div><span className="font-medium">Pickup time:</span> {new Date(trip.pickup_time).toLocaleString()}</div>
              <div><span className="font-medium">Passengers:</span> {trip.passengers || 1}</div>
              <div><span className="font-medium">Driver:</span> {driverName}</div>
              <div><span className="font-medium">Status:</span> <span className="capitalize">{trip.status.replace('_', ' ')}</span></div>
            </div>
            {trip.description && (
              <div className="mt-3 text-sm bg-blue-50 border border-blue-100 rounded-xl p-3 text-blue-900">
                <span className="font-medium text-blue-800">Notes:</span> {trip.description}
              </div>
            )}
          </div>

          <div className="text-right">
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-900 hover:underline"
            >
              Open full route in Google Maps ↗
            </a>
          </div>
        </div>
      </div>

      {/* Live Map */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2 px-1">
          <div className="font-semibold text-lg text-blue-950">Live Location Map</div>
          <div className="text-xs text-blue-900">UPDATES IN REAL TIME</div>
        </div>

        <div className="rounded-3xl overflow-hidden border-2 border-blue-100 bg-white shadow-sm">
          <TripMap
            pickup={trip.pickup_location}
            dropoff={trip.dropoff_location}
            height={480}
            currentLocation={
              hasLiveLocation
                ? { lat: trip.current_lat!, lng: trip.current_lng! }
                : null
            }
            currentLocationLabel="Driver's current location (real-time)"
          />
        </div>

        {/* Live status / last update */}
        <div className="mt-3 rounded-2xl bg-gray-50 border border-gray-200 p-4 text-sm">
          {hasLiveLocation && isInProgress ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <div>
                <span className="font-semibold text-green-700">● Live tracking active</span>
              </div>
              <div className="text-blue-900">
                Last updated: <span className="font-medium">{lastUpdateDisplay}</span>
              </div>
              <div className="text-[11px] text-blue-900">
                (The marker moves automatically when the driver’s phone sends a new location.)
              </div>
            </div>
          ) : trip.status === 'assigned' ? (
            <div className="text-amber-700">
              Driver has not started the trip yet. Live location will appear here once the driver taps “Start Trip” on their phone.
            </div>
          ) : (
            <div className="text-blue-800">
              No current location data available yet.
            </div>
          )}
        </div>
      </div>

      {/* Footer actions */}
      <div className="flex flex-wrap gap-3">
        <Link
          href="/organization/active-trips"
          className="px-6 py-2 border border-gray-300 rounded-xl text-sm font-medium hover:bg-gray-50"
        >
          ← Back to all active trips
        </Link>
        <Link
          href="/organization/trips"
          className="px-6 py-2 text-sm text-blue-900 hover:underline"
        >
          View in full My Trips list
        </Link>
      </div>

      <div className="mt-10 text-[11px] text-center text-blue-600">
        Locations are provided by the driver’s device for safety and accountability only.
      </div>
    </div>
  );
}
