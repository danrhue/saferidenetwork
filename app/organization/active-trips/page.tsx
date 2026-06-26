'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

interface ActiveTrip {
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
  driver_name?: string;
}

export default function OrganizationActiveTrips() {
  const [trips, setTrips] = useState<ActiveTrip[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchActiveTrips = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: tripsData, error } = await supabase
      .from('trips')
      .select(`
        id,
        title,
        description,
        pickup_location,
        dropoff_location,
        pickup_time,
        status,
        passengers,
        assigned_driver_id,
        current_lat,
        current_lng,
        last_location_update
      `)
      .eq('organization_id', user.id)
      .in('status', ['assigned', 'in_progress'])
      .order('pickup_time', { ascending: true });

    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }

    const activeTrips = (tripsData || []) as ActiveTrip[];

    // Fetch driver names for assigned trips
    const driverIds = activeTrips
      .map(t => t.assigned_driver_id)
      .filter((id): id is string => !!id);

    if (driverIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', driverIds);

      const nameMap: Record<string, string> = {};
      (profiles || []).forEach((p: any) => {
        nameMap[p.id] = p.full_name || 'Unknown Driver';
      });

      activeTrips.forEach(trip => {
        if (trip.assigned_driver_id) {
          trip.driver_name = nameMap[trip.assigned_driver_id] || 'Unknown Driver';
        }
      });
    }

    setTrips(activeTrips);
    setLoading(false);
  };

  useEffect(() => {
    fetchActiveTrips();
  }, []);

  const getStatusBadge = (status: string) => {
    if (status === 'in_progress') {
      return 'bg-blue-100 text-blue-800 border-blue-200';
    }
    return 'bg-amber-100 text-amber-800 border-amber-200';
  };

  const formatLastUpdate = (iso: string | null) => {
    if (!iso) return 'No location data yet';
    const date = new Date(iso);
    const diffMs = Date.now() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    const hours = Math.floor(diffMins / 60);
    return `${hours}h ${diffMins % 60}m ago`;
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-center text-blue-800">Loading active trips...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-blue-950">Active Trips — Live Tracking</h1>
        <p className="text-blue-800 mt-1">
          Monitor your drivers in real-time. Location updates automatically via the driver’s phone while the trip is in progress.
        </p>
      </div>

      {trips.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
          <div className="text-4xl mb-4">🗺️</div>
          <h3 className="text-xl font-semibold mb-2">No active trips right now</h3>
          <p className="text-blue-800 max-w-md mx-auto">
            When you approve an offer or assign a driver, the trip will appear here with a live map link once the driver starts tracking.
          </p>
          <Link
            href="/organization/trips"
            className="mt-6 inline-block px-6 py-2 bg-[#1E3A8A] text-white rounded-xl text-sm font-medium hover:bg-blue-900"
          >
            Go to My Trips
          </Link>
        </div>
      ) : (
        <div className="grid gap-6">
          {trips.map((trip) => (
            <div key={trip.id} className="bg-white border border-gray-200 rounded-2xl p-6">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-xl font-semibold text-blue-950">{trip.title}</h3>
                    <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${getStatusBadge(trip.status)}`}>
                      {trip.status === 'in_progress' ? 'IN PROGRESS' : 'ASSIGNED'}
                    </span>
                  </div>

                  <div className="mt-2 text-lg text-blue-900">
                    {trip.pickup_location} <span className="text-[#1E3A8A]">→</span> {trip.dropoff_location}
                  </div>

                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1 text-sm text-blue-800">
                    <div>
                      <span className="font-medium text-blue-900">Pickup:</span> {new Date(trip.pickup_time).toLocaleString()}
                    </div>
                    <div>
                      <span className="font-medium text-blue-900">Passengers:</span> {trip.passengers || 1}
                    </div>
                    <div>
                      <span className="font-medium text-blue-900">Driver:</span> {trip.driver_name || 'Pending assignment'}
                    </div>
                  </div>

                  {trip.description && (
                    <div className="mt-3 text-sm text-blue-800 bg-gray-50 rounded-xl p-3 border border-gray-100">
                      {trip.description}
                    </div>
                  )}

                  {trip.status === 'in_progress' && (
                    <div className="mt-3 text-sm">
                      <span className="font-medium text-blue-900">Last location update:</span>{' '}
                      <span className="text-blue-900">{formatLastUpdate(trip.last_location_update)}</span>
                      {trip.current_lat && trip.current_lng && (
                        <span className="ml-2 inline-block px-2 py-0.5 text-[10px] bg-green-100 text-green-700 rounded">LIVE DATA</span>
                      )}
                    </div>
                  )}
                </div>

                <div className="lg:text-right flex-shrink-0">
                  <Link
                    href={`/organization/active-trips/${trip.id}`}
                    className="inline-flex items-center justify-center px-8 py-3 bg-[#1E3A8A] hover:bg-blue-900 text-white text-base font-semibold rounded-2xl shadow transition"
                  >
                    View Live Map →
                  </Link>
                  <div className="mt-2 text-xs text-blue-900">
                    Real-time GPS • Updates automatically
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 text-sm text-blue-900">
        Tip: Keep this page open or the live map view to watch locations update live as drivers move.
      </div>
    </div>
  );
}
