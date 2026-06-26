'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { insertTripLocationPoint } from '@/lib/trip-locations';
import { authFetch } from '@/lib/auth-fetch';
import TripMap from '../../../components/TripMap';
import OrganizationLogo from '../../../components/OrganizationLogo';

interface Trip {
  id: string;
  title: string;
  description: string | null;
  pickup_location: string;
  dropoff_location: string;
  pickup_time: string;
  status: string;
  assigned_driver_id: string | null;
  passengers: number | null;
  started_at: string | null;
  ended_at: string | null;
  start_lat: number | null;
  start_lng: number | null;
  end_lat: number | null;
  end_lng: number | null;
  current_lat: number | null;
  current_lng: number | null;
  last_location_update: string | null;
  checklist_completed_at?: string | null;
  organization_id?: string;
  organization_name?: string;
  organization_photo_url?: string | null;
}

export default function TripExecutionScreen() {
  const params = useParams<{ tripId: string }>();
  const router = useRouter();
  const tripId = params.tripId;

  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Live tracking state
  const [watchId, setWatchId] = useState<number | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const lastUpdateRef = useRef<number>(0);
  const lastPosRef = useRef<{ lat: number; lng: number } | null>(null);

  // Pre-trip safety checklist state (must all be true to enable Start)
  const [checklist, setChecklist] = useState({
    locationGranted: false,
    passengersVerified: false,
    secured: false,
  });

  const fetchTrip = async () => {
    setLoading(true);
    setError(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }
    setUserId(user.id);

    const { data, error: fetchError } = await supabase
      .from('trips')
      .select(`
        *,
        profiles:organization_id (organization_name, profile_photo_url)
      `)
      .eq('id', tripId)
      .single();

    if (fetchError || !data) {
      setError('Trip not found or you do not have access.');
      setLoading(false);
      return;
    }

    const raw = data as any;
    const t: Trip = {
      ...raw,
      organization_name: raw.profiles?.organization_name || undefined,
      organization_photo_url: raw.profiles?.profile_photo_url || null,
    };

    // Role protection: only the assigned driver can access
    if (!t.assigned_driver_id || t.assigned_driver_id !== user.id) {
      setError('You are not assigned to this trip. Only the assigned driver can access the trip execution screen.');
      setLoading(false);
      return;
    }

    setTrip(t);
    setLoading(false);
  };

  useEffect(() => {
    if (tripId) {
      fetchTrip();
    }
  }, [tripId]);

  // Supabase Realtime subscription: listen for location/status updates on this specific trip
  useEffect(() => {
    if (!tripId) return;

    const channel = supabase
      .channel(`trip-location-${tripId}`)
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
            // Merge live fields + important status changes coming from any source (including our own throttled writes)
            return {
              ...prev,
              status: updated.status ?? prev.status,
              current_lat: updated.current_lat ?? prev.current_lat,
              current_lng: updated.current_lng ?? prev.current_lng,
              last_location_update: updated.last_location_update ?? prev.last_location_update,
              started_at: updated.started_at ?? prev.started_at,
              ended_at: updated.ended_at ?? prev.ended_at,
            };
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tripId]);

  // Auto-start or stop live tracking based on trip status (supports page refresh while trip is in_progress)
  useEffect(() => {
    if (!trip || !userId) return;

    const isDriverAssigned = trip.assigned_driver_id === userId;
    const shouldTrack = trip.status === 'in_progress' && isDriverAssigned;

    if (shouldTrack && !isTracking) {
      // Resume tracking (e.g. after reload or coming back to the tab)
      startLiveTracking();
    } else if (!shouldTrack && isTracking) {
      stopLiveTracking();
    }
  }, [trip?.status, userId]); // intentionally omit isTracking to prevent loops; guards live inside the functions

  // Cleanup: always stop watchPosition when leaving the screen
  useEffect(() => {
    return () => {
      stopLiveTracking();
    };
  }, []);

  const speakDirections = () => {
    if (!trip || !('speechSynthesis' in window)) {
      alert('Voice directions are not supported in this browser. Try Chrome or Safari on your phone.');
      return;
    }

    const timeStr = new Date(trip.pickup_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const pass = trip.passengers || 1;

    const text = `Trip from ${trip.pickup_location} to ${trip.dropoff_location}. Pickup at ${timeStr}. ${pass} passenger${pass !== 1 ? 's' : ''}. Drive safely and have a good trip.`;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.92;
    utterance.pitch = 1.0;
    window.speechSynthesis.cancel(); // stop any previous
    window.speechSynthesis.speak(utterance);
  };

  const openInGoogleMaps = () => {
    if (!trip) return;
    const url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(trip.pickup_location)}&destination=${encodeURIComponent(trip.dropoff_location)}&travelmode=driving`;
    window.open(url, '_blank');
  };

  // Haversine distance in km (used for throttling live updates)
  const getDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const stopLiveTracking = () => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }
    setIsTracking(false);
  };

  const startLiveTracking = () => {
    if (!navigator.geolocation) return;
    if (isTracking) return; // already watching

    const id = navigator.geolocation.watchPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const now = Date.now();

        const lastTime = lastUpdateRef.current;
        const lastPos = lastPosRef.current;

        let shouldUpdate = false;
        if (!lastPos) {
          shouldUpdate = true;
        } else {
          const distKm = getDistanceKm(lastPos.lat, lastPos.lng, lat, lng);
          if (now - lastTime > 8000 || distKm > 0.05) {
            // 8 seconds OR moved more than ~50 meters
            shouldUpdate = true;
          }
        }

        if (shouldUpdate && userId && trip) {
          lastUpdateRef.current = now;
          lastPosRef.current = { lat, lng };

          // Optimistic update for instant marker movement on the map
          setTrip((prev) =>
            prev
              ? {
                  ...prev,
                  current_lat: lat,
                  current_lng: lng,
                  last_location_update: new Date().toISOString(),
                }
              : null
          );

          // Persist to DB (throttled). Use .then to avoid blocking UI
          supabase
            .from('trips')
            .update({
              current_lat: lat,
              current_lng: lng,
              last_location_update: new Date().toISOString(),
            })
            .eq('id', trip.id)
            .eq('assigned_driver_id', userId)
            .then(({ error }) => {
              if (error) {
                console.error('Live location DB update failed:', error);
              }
            });

          // Record point to trip_locations for historical trail (admin oversight)
          insertTripLocationPoint(supabase, {
            trip_id: trip.id,
            lat,
            lng,
            speed: position.coords.speed ?? null,
            accuracy: position.coords.accuracy ?? null,
          }).then(({ error }) => {
            if (error) console.error('Location history insert error:', error);
          });
        }
      },
      (err) => {
        console.warn('Geolocation watch error (non-fatal):', err);
        // Do not spam the driver with alerts while driving
      },
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 5000,
      }
    );

    setWatchId(id);
    setIsTracking(true);
  };

  const handleStartTrip = async () => {
    if (!trip || !userId) return;

    // Safety checklist must be fully completed
    const allChecked = checklist.locationGranted && checklist.passengersVerified && checklist.secured;
    if (!allChecked) {
      alert('Please complete the safety checklist above before starting the trip. All items are required for passenger safety.');
      return;
    }

    if (!confirm('START TRIP now?\n\nThis will:\n• Record your current location (for safety)\n• Set status to In Progress\n• Record start time\n\nOnly tap Start when you are at the pickup location ready to go.')) {
      return;
    }

    setActionLoading(true);

    try {
      if (!navigator.geolocation) {
        throw new Error('Location services not available on this device. Please enable GPS.');
      }

      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        });
      });

      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      const now = new Date().toISOString();

      const { error: updateError } = await supabase
        .from('trips')
        .update({
          status: 'in_progress',
          started_at: now,
          start_lat: lat,
          start_lng: lng,
          updated_at: now,
          checklist_completed_at: now,  // Record that safety checklist was completed
        })
        .eq('id', trip.id)
        .eq('assigned_driver_id', userId);

      if (updateError) throw updateError;

      // Seed the first current location (same as start) and begin continuous tracking
      lastUpdateRef.current = Date.now();
      lastPosRef.current = { lat, lng };

      setTrip((prev) =>
        prev
          ? {
              ...prev,
              status: 'in_progress',
              started_at: now,
              start_lat: lat,
              start_lng: lng,
              current_lat: lat,
              current_lng: lng,
              last_location_update: now, // ISO string from the start position capture
              checklist_completed_at: now,
            }
          : null
      );

      // Start continuous watchPosition + throttled DB writes + realtime marker updates
      startLiveTracking();

      alert('Trip started. Live GPS tracking is now active — drive safely!');

      // Notify rider when this is a rider-sourced trip
      authFetch('/api/rider/notifications/trip-lifecycle', {
        method: 'POST',
        body: JSON.stringify({ tripId: trip.id, event: 'driver_en_route' }),
      }).catch((err) => console.error('driver_en_route notification failed:', err));

      await fetchTrip();
    } catch (err: any) {
      console.error(err);
      const msg = err?.message || 'Unable to get your location. Please allow location access in your browser settings and try again.';
      alert('Could not start trip: ' + msg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCompleteTrip = async () => {
    if (!trip || !userId) return;

    if (!confirm('COMPLETE TRIP now?\n\nThis will:\n• Record your current location (for safety records)\n• Set status to Completed\n• Record end time\n\nOnly tap Complete after you have safely dropped off all passengers.')) {
      return;
    }

    setActionLoading(true);

    // Stop live GPS tracking immediately
    stopLiveTracking();

    try {
      if (!navigator.geolocation) {
        throw new Error('Location services not available.');
      }

      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        });
      });

      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      const now = new Date().toISOString();

      const { error: updateError } = await supabase
        .from('trips')
        .update({
          status: 'completed',
          ended_at: now,
          end_lat: lat,
          end_lng: lng,
          current_lat: lat,
          current_lng: lng,
          last_location_update: now,
          updated_at: now,
        })
        .eq('id', trip.id)
        .eq('assigned_driver_id', userId);

      if (updateError) throw updateError;

      alert('Trip completed. Thank you for driving safely!');

      authFetch('/api/rider/notifications/trip-lifecycle', {
        method: 'POST',
        body: JSON.stringify({ tripId: trip.id, event: 'trip_completed' }),
      }).catch((err) => console.error('trip_completed notification failed:', err));

      await fetchTrip();
    } catch (err: any) {
      console.error(err);
      const msg = err?.message || 'Unable to get your location or update trip.';
      alert('Could not complete trip: ' + msg);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl text-blue-950">Loading trip...</div>
          <p className="text-gray-500 mt-2">Preparing your route</p>
        </div>
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="max-w-md mx-auto mt-10 p-8 bg-white border border-gray-200 rounded-2xl text-center">
        <div className="text-5xl mb-4">🚫</div>
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">Access Restricted</h2>
        <p className="text-gray-600 mb-6">{error || 'This trip is not available.'}</p>
        <Link
          href="/dashboard/active-trips"
          className="inline-block px-8 py-3 bg-[#1E3A8A] text-white rounded-2xl text-lg font-medium"
        >
          Back to Active Trips
        </Link>
      </div>
    );
  }

  const status = trip.status;
  const isAssigned = status === 'assigned';
  const isInProgress = status === 'in_progress';
  const isCompleted = status === 'completed';

  const statusLabel = isAssigned ? 'ASSIGNED' : isInProgress ? 'IN PROGRESS' : isCompleted ? 'COMPLETED' : status.toUpperCase();
  const statusColor = isAssigned ? 'bg-green-100 text-green-800' : isInProgress ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-700';

  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(trip.pickup_location)}&destination=${encodeURIComponent(trip.dropoff_location)}&travelmode=driving`;

  const formatTime = (iso: string | null) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

  return (
    <div className="max-w-3xl mx-auto pb-12">
      {/* Calm top header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link href="/dashboard/active-trips" className="text-sm text-blue-700 hover:underline flex items-center gap-1">
            ← Back to Active Trips
          </Link>
          <h1 className="text-3xl font-bold text-blue-950 mt-1 tracking-tight">Trip Execution</h1>
          <p className="text-blue-800 text-sm mt-0.5">Simple. Safe. Mobile-optimized for drivers.</p>
        </div>
        <div className={`px-5 py-1.5 rounded-2xl text-sm font-semibold ${statusColor}`}>
          {statusLabel}
        </div>
      </div>

      {/* Trip Title + Organization */}
      <div className="mb-5">
        <div className="flex items-center gap-3 mb-1">
          <OrganizationLogo photoPath={trip.organization_photo_url} size={36} />
          <div className="text-2xl font-semibold text-gray-900">{trip.title}</div>
        </div>
        {trip.organization_name && (
          <div className="text-sm text-blue-800 ml-12">Posted by {trip.organization_name}</div>
        )}
      </div>

      {/* Big Route Display */}
      <div className="bg-white border-2 border-blue-200 rounded-3xl p-6 mb-6 shadow-sm">
        <div className="flex items-center gap-3 text-xl md:text-2xl font-semibold text-gray-900 leading-tight">
          <span className="flex-1">{trip.pickup_location}</span>
          <span className="text-3xl text-[#1E3A8A] select-none">→</span>
          <span className="flex-1 text-right">{trip.dropoff_location}</span>
        </div>

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div className="bg-blue-50 rounded-2xl px-4 py-3">
            <div className="uppercase tracking-widest text-[10px] text-blue-700 font-medium">Pickup Time</div>
            <div className="font-semibold text-blue-950 text-lg mt-0.5">
              {new Date(trip.pickup_time).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
            </div>
          </div>

          <div className="bg-blue-50 rounded-2xl px-4 py-3">
            <div className="uppercase tracking-widest text-[10px] text-blue-700 font-medium">Passengers</div>
            <div className="font-semibold text-blue-950 text-lg mt-0.5">
              {trip.passengers || 1} { (trip.passengers || 1) === 1 ? 'passenger' : 'passengers' }
            </div>
          </div>

          <div className="bg-blue-50 rounded-2xl px-4 py-3">
            <div className="uppercase tracking-widest text-[10px] text-blue-700 font-medium">Status</div>
            <div className="font-semibold text-blue-950 text-lg mt-0.5 capitalize">{status.replace('_', ' ')}</div>
          </div>
        </div>

        {/* Notes */}
        {trip.description && (
          <div className="mt-4 pt-4 border-t border-blue-100">
            <div className="uppercase tracking-widest text-[10px] text-blue-700 font-medium mb-1">Notes from Organization</div>
            <p className="text-gray-800 leading-relaxed text-[15px]">{trip.description}</p>
          </div>
        )}
      </div>

      {/* Google Map - prominent and large on phone + live moving driver marker */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2 px-1">
          <div className="font-semibold text-blue-950 text-lg">Route Map + Live Position</div>
          <div className="text-xs text-gray-500">DRIVING • REAL-TIME</div>
        </div>

        <div className="rounded-3xl overflow-hidden border-2 border-blue-100 shadow-sm bg-white">
          <TripMap
            pickup={trip.pickup_location}
            dropoff={trip.dropoff_location}
            height={460}
            currentLocation={
              trip.current_lat != null && trip.current_lng != null
                ? { lat: trip.current_lat, lng: trip.current_lng }
                : null
            }
          />
        </div>

        {/* Live tracking status indicator (visible while in_progress) */}
        {isInProgress && (
          <div className="mt-3 flex items-center justify-center gap-2 rounded-2xl bg-blue-100 px-4 py-2 text-sm font-medium text-blue-800">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-blue-600" />
            Live GPS tracking active — location updates automatically for safety &amp; accountability
          </div>
        )}
      </div>

      {/* Simple Navigation Aids */}
      <div className="flex flex-col sm:flex-row gap-3 mb-8">
        <button
          onClick={speakDirections}
          className="flex-1 h-14 text-lg font-medium rounded-2xl border-2 border-blue-200 bg-white hover:bg-blue-50 active:bg-blue-100 text-blue-950 flex items-center justify-center gap-2 transition"
        >
          🔊 Speak Directions
        </button>
        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 h-14 text-lg font-medium rounded-2xl border-2 border-blue-200 bg-white hover:bg-blue-50 active:bg-blue-100 text-blue-950 flex items-center justify-center gap-2 transition"
        >
          🗺️ Open in Google Maps
        </a>
      </div>

      {/* Location Safety Note + Transparency */}
      <div className="text-xs text-center text-gray-500 mb-4 px-6">
        When the trip is active, your phone continuously sends location updates (throttled for battery). This is only visible to the assigned organization for safety and accountability. Tracking stops automatically on Complete.
      </div>

      {/* Driver Pre-Trip Safety Checklist (required before Start) */}
      {isAssigned && (
        <div className="bg-white border-2 border-blue-200 rounded-3xl p-6 mb-6">
          <div className="font-semibold text-lg text-blue-950 mb-2 flex items-center gap-2">
            ✅ Pre-Trip Safety Checklist
          </div>
          <p className="text-sm text-gray-600 mb-4">For the safety of all passengers, please confirm the following before you can start the trip. All items are required.</p>

          <div className="space-y-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={checklist.locationGranted}
                onChange={(e) => setChecklist(prev => ({...prev, locationGranted: e.target.checked}))}
                className="mt-1 w-5 h-5 accent-blue-600"
              />
              <span className="text-sm text-gray-800">I have granted location tracking permission and my phone's GPS is enabled and accurate.</span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={checklist.passengersVerified}
                onChange={(e) => setChecklist(prev => ({...prev, passengersVerified: e.target.checked}))}
                className="mt-1 w-5 h-5 accent-blue-600"
              />
              <span className="text-sm text-gray-800">I have verified the names and count of all passengers against the trip details.</span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={checklist.secured}
                onChange={(e) => setChecklist(prev => ({...prev, secured: e.target.checked}))}
                className="mt-1 w-5 h-5 accent-blue-600"
              />
              <span className="text-sm text-gray-800">All passengers are properly buckled in / secured (car seats, seatbelts, etc. as required).</span>
            </label>
          </div>

          <div className="mt-3 text-xs text-blue-700">Checklist must be 100% complete to enable the Start Trip button.</div>
        </div>
      )}

      {/* Big Action Buttons - the heart of the mobile driver screen */}
      <div className="space-y-4">
        {isAssigned && (
          <button
            onClick={handleStartTrip}
            disabled={actionLoading || !(checklist.locationGranted && checklist.passengersVerified && checklist.secured)}
            className="w-full h-20 text-2xl font-semibold bg-green-600 hover:bg-green-700 active:bg-green-800 text-white rounded-3xl shadow-md disabled:opacity-60 disabled:cursor-not-allowed transition flex items-center justify-center"
          >
            {actionLoading ? 'Getting Location & Starting...' : 'START TRIP'}
          </button>
        )}

        {isInProgress && (
          <button
            onClick={handleCompleteTrip}
            disabled={actionLoading}
            className="w-full h-20 text-2xl font-semibold bg-[#1E3A8A] hover:bg-blue-900 active:bg-blue-950 text-white rounded-3xl shadow-md disabled:opacity-60 disabled:cursor-not-allowed transition flex items-center justify-center"
          >
            {actionLoading ? 'Saving Location & Completing...' : 'COMPLETE TRIP'}
          </button>
        )}

        {isCompleted && (
          <div className="w-full py-8 bg-green-50 border-2 border-green-200 rounded-3xl text-center">
            <div className="text-4xl mb-2">✅</div>
            <div className="text-2xl font-semibold text-green-800">Trip Completed</div>
            <p className="text-green-700 mt-1">Thank you for a safe drive.</p>

            {/* Summary of times + captured locations */}
            <div className="mt-5 mx-auto max-w-xs text-sm bg-white/70 rounded-2xl p-4 text-left border border-green-100">
              <div className="grid grid-cols-2 gap-y-2">
                <div className="text-green-700">Started</div>
                <div className="font-medium text-green-900 text-right">{formatTime(trip.started_at)}</div>
                <div className="text-green-700">Ended</div>
                <div className="font-medium text-green-900 text-right">{formatTime(trip.ended_at)}</div>
              </div>
              {trip.start_lat && trip.start_lng && (
                <div className="text-[11px] text-green-600 mt-3">Start + end locations + full live path captured</div>
              )}
              {trip.last_location_update && (
                <div className="text-[10px] text-green-600 mt-1">Last live update: {new Date(trip.last_location_update).toLocaleTimeString()}</div>
              )}
            </div>
          </div>
        )}

        {!isAssigned && !isInProgress && !isCompleted && (
          <div className="text-center py-6 text-gray-500">Trip is {status}. No further action needed here.</div>
        )}
      </div>

      {/* Footer actions */}
      <div className="mt-8 text-center">
        <Link
          href="/dashboard/active-trips"
          className="text-blue-700 hover:text-blue-900 underline text-sm"
        >
          Return to Active Trips
        </Link>
      </div>

      {/* Extra calm footer note */}
      <div className="mt-10 text-[11px] text-center text-gray-400">
        Safe Ride Network • Tap large buttons only when safe to do so. Never use phone while driving.
      </div>
    </div>
  );
}
