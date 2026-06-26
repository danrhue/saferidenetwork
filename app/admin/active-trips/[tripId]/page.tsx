'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { ADMIN_FORBIDDEN_ERROR } from '@/lib/admin-access';
import { normalizeTripLocation } from '@/lib/trip-locations';
import TripMap from '../../../components/TripMap';
import {
  haversineDistanceMeters,
  processGeofenceHistory,
  detectGeofenceTransitions,
  GeofenceEvent,
  GeofenceZone,
  DEFAULT_GEOFENCE_RADIUS_METERS,
  type LatLng,
} from '@/lib/geo-utils';

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
  organization_id: string;
  current_lat: number | null;
  current_lng: number | null;
  last_location_update: string | null;
  started_at: string | null;
  ended_at: string | null;
}

export default function AdminLiveTripDetail() {
  const params = useParams<{ tripId: string }>();
  const router = useRouter();
  const tripId = params.tripId;

  const [trip, setTrip] = useState<Trip | null>(null);
  const [orgName, setOrgName] = useState('Unknown Organization');
  const [driverName, setDriverName] = useState('Unknown Driver');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdateDisplay, setLastUpdateDisplay] = useState('');
  const [historicalPath, setHistoricalPath] = useState<{ lat: number; lng: number }[]>([]);
  const [durationDisplay, setDurationDisplay] = useState('');

  // Geofencing state (real-time enter/exit around pickup & dropoff)
  const [pickupCenter, setPickupCenter] = useState<LatLng | null>(null);
  const [dropoffCenter, setDropoffCenter] = useState<LatLng | null>(null);
  const [geofenceStatuses, setGeofenceStatuses] = useState<Record<string, 'inside' | 'outside'>>({});
  const [geofenceEvents, setGeofenceEvents] = useState<GeofenceEvent[]>([]);
  const [geofenceLoading, setGeofenceLoading] = useState(false);

  const getRelativeTime = (iso: string | null): string => {
    if (!iso) return 'No updates yet';
    const then = new Date(iso).getTime();
    const diffMs = Date.now() - then;
    const sec = Math.floor(diffMs / 1000);
    if (sec < 30) return 'Just now';
    if (sec < 60) return `${sec}s ago`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min} min ago`;
    return `${Math.floor(min / 60)}h ago`;
  };

  // Geocode trip addresses to obtain circular geofence centers (200m radius)
  const geocodeAndInitializeGeofences = useCallback(async (pickupAddr: string, dropoffAddr: string) => {
    setGeofenceLoading(true);
    const tryGeocode = () => {
      if (!window.google?.maps?.Geocoder) {
        setTimeout(tryGeocode, 380);
        return;
      }
      const geocoder = new google.maps.Geocoder();
      let resolved = 0;
      const total = 2;

      const done = () => {
        resolved++;
        if (resolved >= total) setGeofenceLoading(false);
      };

      geocoder.geocode({ address: pickupAddr }, (results, status) => {
        if (status === 'OK' && results && results[0]) {
          const loc = results[0].geometry.location;
          const center = { lat: loc.lat(), lng: loc.lng() };
          setPickupCenter(center);
        } else {
          // Fallback: leave null (no circle for this zone)
          console.warn('Geocode pickup failed', status);
        }
        done();
      });

      geocoder.geocode({ address: dropoffAddr }, (results, status) => {
        if (status === 'OK' && results && results[0]) {
          const loc = results[0].geometry.location;
          const center = { lat: loc.lat(), lng: loc.lng() };
          setDropoffCenter(center);
        } else {
          console.warn('Geocode dropoff failed', status);
        }
        done();
      });
    };
    tryGeocode();
  }, []);

  // Build zones from current centers (simple fixed-radius circular geofences)
  const buildZones = useCallback((): GeofenceZone[] => {
    const zones: GeofenceZone[] = [];
    if (pickupCenter) {
      zones.push({
        id: 'pickup',
        label: 'Pickup zone',
        center: pickupCenter,
        radiusMeters: DEFAULT_GEOFENCE_RADIUS_METERS,
      });
    }
    if (dropoffCenter) {
      zones.push({
        id: 'dropoff',
        label: 'Dropoff zone',
        center: dropoffCenter,
        radiusMeters: DEFAULT_GEOFENCE_RADIUS_METERS,
      });
    }
    return zones;
  }, [pickupCenter, dropoffCenter]);

  // Seed geofence events + statuses by replaying the full historical path (deterministic)
  const seedGeofenceFromHistory = useCallback((path: { lat: number; lng: number }[]) => {
    const zones = buildZones();
    if (zones.length === 0 || path.length === 0) return;

    const { events, finalStatuses } = processGeofenceHistory(
      path as LatLng[],
      zones
    );
    setGeofenceEvents(events);
    setGeofenceStatuses(finalStatuses);
  }, [buildZones]);

  // Called on every new point (realtime location INSERT or current update)
  const handleNewLocationForGeofences = useCallback((point: LatLng) => {
    const zones = buildZones();
    if (zones.length === 0) return;

    setGeofenceStatuses((prev) => {
      const { newEvents, newStatuses } = detectGeofenceTransitions(point, zones, prev);
      if (newEvents.length > 0) {
        setGeofenceEvents((evs) => [...evs, ...newEvents]);
      }
      return newStatuses;
    });
  }, [buildZones]);

  const fetchTripAndNames = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/trips/${tripId}`, { cache: 'no-store' });

      if (res.status === 401) {
        router.replace('/admin/login');
        return;
      }

      if (res.status === 403) {
        router.replace(`/admin?error=${encodeURIComponent(ADMIN_FORBIDDEN_ERROR)}`);
        return;
      }

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Trip not found.');
        setLoading(false);
        return;
      }

      const t = data.trip as Trip;
      setTrip(t);
      setOrgName(data.organization_name || 'Unknown Organization');
      setDriverName(data.driver_name || 'Unknown Driver');

      const loadedPath: { lat: number; lng: number }[] = Array.isArray(data.locations)
        ? data.locations
        : [];
      if (loadedPath.length > 0) {
        setHistoricalPath(loadedPath);
      }

      setLoading(false);
      geocodeAndInitializeGeofences(t.pickup_location, t.dropoff_location);
    } catch (err) {
      console.error(err);
      setError('Failed to load trip data.');
      setLoading(false);
    }
  }, [tripId, router, geocodeAndInitializeGeofences]);

  // Realtime for live marker
  useEffect(() => {
    if (!tripId) return;

    const channel = supabase
      .channel(`admin-trip-live-${tripId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'trips',
        filter: `id=eq.${tripId}`,
      }, (payload) => {
        const updated = payload.new as any;
        setTrip(prev => prev ? {
          ...prev,
          status: updated.status ?? prev.status,
          current_lat: updated.current_lat ?? prev.current_lat,
          current_lng: updated.current_lng ?? prev.current_lng,
          last_location_update: updated.last_location_update ?? prev.last_location_update,
          started_at: updated.started_at ?? prev.started_at,
        } : null);

        // Also feed latest current location into geofence detector (covers live marker without new trip_locations row)
        if (updated.current_lat != null && updated.current_lng != null) {
          handleNewLocationForGeofences({ lat: Number(updated.current_lat), lng: Number(updated.current_lng) });
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [tripId]);

  // Realtime for new location points (append to historical path for trip trail)
  useEffect(() => {
    if (!tripId) return;

    const locChannel = supabase
      .channel(`admin-trip-locs-${tripId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'trip_locations',
        filter: `trip_id=eq.${tripId}`,
      }, (payload) => {
        const normalized = normalizeTripLocation(payload.new as any);
        if (!normalized) return;
        const pt = { lat: normalized.lat, lng: normalized.lng };
        setHistoricalPath(prev => [...prev, pt]);
        handleNewLocationForGeofences(pt);
      })
      .subscribe();

    return () => { supabase.removeChannel(locChannel); };
  }, [tripId]);

  // Refresh relative time
  useEffect(() => {
    const tick = () => {
      if (trip) setLastUpdateDisplay(getRelativeTime(trip.last_location_update));
    };
    tick();
    const i = setInterval(tick, 15000);
    return () => clearInterval(i);
  }, [trip?.last_location_update]);

  // Live trip duration timer (since started, for in_progress trips)
  useEffect(() => {
    if (!trip || trip.status !== 'in_progress' || !trip.started_at) {
      setDurationDisplay('');
      return;
    }

    const updateDuration = () => {
      const start = new Date(trip.started_at!).getTime();
      const diffMs = Date.now() - start;
      const mins = Math.floor(diffMs / 60000);
      const hrs = Math.floor(mins / 60);
      const remMins = mins % 60;
      setDurationDisplay(hrs > 0 ? `${hrs}h ${remMins}m` : `${remMins}m`);
    };

    updateDuration();
    const iv = setInterval(updateDuration, 30000);
    return () => clearInterval(iv);
  }, [trip?.status, trip?.started_at]);

  useEffect(() => {
    if (tripId) fetchTripAndNames();
  }, [tripId, fetchTripAndNames]);

  // Poll trip position via admin API (client RLS cannot read all trips for realtime)
  useEffect(() => {
    if (!tripId || !trip) return;
    if (!['assigned', 'in_progress'].includes(trip.status)) return;

    const poll = async () => {
      try {
        const res = await fetch(`/api/admin/trips/${tripId}`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (!data.trip) return;
        setTrip((prev) =>
          prev
            ? {
                ...prev,
                status: data.trip.status ?? prev.status,
                current_lat: data.trip.current_lat ?? prev.current_lat,
                current_lng: data.trip.current_lng ?? prev.current_lng,
                last_location_update:
                  data.trip.last_location_update ?? prev.last_location_update,
                started_at: data.trip.started_at ?? prev.started_at,
              }
            : null
        );
      } catch {
        // ignore transient poll errors
      }
    };

    const iv = setInterval(poll, 20000);
    return () => clearInterval(iv);
  }, [tripId, trip?.status]);

  // When centers become available OR historical path updates, (re)seed geofence events & statuses by full replay
  useEffect(() => {
    const zones = buildZones();
    if (zones.length > 0 && historicalPath.length > 0) {
      // Rebuild from complete path to ensure correct event sequence even after reconnects
      const { events, finalStatuses } = processGeofenceHistory(historicalPath as LatLng[], zones);
      setGeofenceEvents(events);
      setGeofenceStatuses(finalStatuses);
    }
  }, [pickupCenter, dropoffCenter, historicalPath, buildZones]);

  // If currentLocation is known early (before many path points), ensure at least one geofence check
  useEffect(() => {
    if (trip && trip.current_lat != null && trip.current_lng != null) {
      // Only seed a check if we have no events yet and centers exist
      if (Object.keys(geofenceStatuses).length === 0 && (pickupCenter || dropoffCenter)) {
        handleNewLocationForGeofences({ lat: trip.current_lat, lng: trip.current_lng });
      }
    }
  }, [trip?.current_lat, trip?.current_lng, pickupCenter, dropoffCenter, geofenceStatuses, handleNewLocationForGeofences]);

  if (loading) {
    return <div className="p-8 bg-blue-50 min-h-screen">Loading live trip data...</div>;
  }

  if (error || !trip) {
    return (
      <div className="max-w-md mx-auto mt-10 p-8 bg-white border border-blue-200 rounded-3xl text-center shadow-sm">
        <div className="text-5xl mb-4">◌</div>
        <h2 className="text-2xl font-semibold text-blue-950 tracking-tight">Access Restricted or Trip Not Found</h2>
        <p className="text-blue-800 my-4 text-sm">{error}</p>
        <Link href="/admin/active-trips" className="inline-block px-6 py-2 bg-[#1E3A8A] text-white text-sm font-semibold rounded-2xl">Back to Active Trips</Link>
      </div>
    );
  }

  const isLive = trip.status === 'in_progress' && trip.current_lat != null && trip.current_lng != null;
  const hasLocation = trip.current_lat != null && trip.current_lng != null;

  const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(trip.pickup_location)}&destination=${encodeURIComponent(trip.dropoff_location)}&travelmode=driving`;

  return (
    <div className="min-h-screen bg-blue-50 p-8">
      <div className="max-w-5xl mx-auto">
        {/* Admin Nav — minimal and calm */}
        <div className="mb-6 flex items-center justify-between text-sm">
          <Link href="/admin/active-trips" className="inline-flex items-center gap-1 text-blue-700 hover:text-blue-800 font-medium">← BACK TO ACTIVE TRIPS</Link>
          <div className="flex gap-3 text-blue-700 text-sm">
            <button onClick={() => router.push('/admin/documents')} className="hover:text-blue-900">Documents</button>
            <button onClick={() => router.push('/admin/updates')} className="hover:text-blue-900">Updates</button>
            <button onClick={() => router.push('/dashboard')} className="hover:text-blue-900">Exit Admin</button>
          </div>
        </div>

        {/* Authoritative monitoring header */}
        <div className="mb-7">
          <div className="flex items-center gap-3">
            <h1 className="text-[28px] font-semibold text-blue-950 tracking-[-0.4px]">Live Trip Monitoring</h1>
            {isLive && (
              <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold tracking-[1.25px] px-3 py-px rounded-full bg-emerald-600 text-white">
                <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" /> LIVE GPS
              </span>
            )}
          </div>
          <p className="mt-1 text-[15px] text-blue-700">Real-time position, historical trail, and geofence zone monitoring for the assigned driver.</p>
        </div>

        {/* Trip Header — substantial, premium panel with elevated hierarchy */}
        <div className="bg-white border border-blue-200 rounded-3xl p-6 mb-6 shadow-sm">
          <div className="text-[22px] font-semibold text-blue-950 tracking-[-0.25px] leading-tight">{trip.title}</div>
          <div className="mt-1.5 text-[15px] font-medium text-slate-700 tracking-tight">
            {trip.pickup_location} <span className="text-[#1E3A8A] mx-0.5">→</span> {trip.dropoff_location}
          </div>

          <div className="mt-5 pt-4 border-t border-blue-100 grid sm:grid-cols-2 gap-x-8 gap-y-3 text-[13.5px]">
            <div className="text-blue-900"><span className="text-blue-900/60 text-[10px] font-semibold tracking-[0.75px] block mb-px">ORGANIZATION</span> <span className="text-blue-950 font-semibold">{orgName}</span></div>
            <div className="text-blue-900"><span className="text-blue-900/60 text-[10px] font-semibold tracking-[0.75px] block mb-px">DRIVER</span> <span className="text-blue-950 font-semibold">{driverName}</span></div>
            <div className="text-blue-900"><span className="text-blue-900/60 text-[10px] font-semibold tracking-[0.75px] block mb-px">STATUS</span> <span className="text-blue-950 font-semibold capitalize tracking-tight">{trip.status.replace('_', ' ')}</span></div>
            <div className="text-blue-900"><span className="text-blue-900/60 text-[10px] font-semibold tracking-[0.75px] block mb-px">PASSENGERS</span> <span className="text-blue-950 font-semibold">{trip.passengers || 1}</span></div>
            <div className="text-blue-900"><span className="text-blue-900/60 text-[10px] font-semibold tracking-[0.75px] block mb-px">SCHEDULED PICKUP</span> <span className="text-blue-950 font-semibold">{new Date(trip.pickup_time).toLocaleString()}</span></div>
            <div className="text-blue-900"><span className="text-blue-900/60 text-[10px] font-semibold tracking-[0.75px] block mb-px">STARTED</span> <span className="text-blue-950 font-semibold">{trip.started_at ? new Date(trip.started_at).toLocaleString() : '—'}</span></div>
            <div className="text-blue-900"><span className="text-blue-900/60 text-[10px] font-semibold tracking-[0.75px] block mb-px">LAST GPS UPDATE</span> <span className="text-blue-950 font-semibold">{lastUpdateDisplay || '—'}</span></div>
            {durationDisplay && <div className="text-blue-900"><span className="text-blue-900/60 text-[10px] font-semibold tracking-[0.75px] block mb-px">DURATION ACTIVE</span> <span className="text-blue-950 font-semibold">{durationDisplay}</span></div>}
            {trip.description && <div className="sm:col-span-2 text-blue-900 mt-1"><span className="text-blue-900/60 text-[10px] font-semibold tracking-[0.75px] block mb-px">NOTES</span> <span className="text-blue-950 font-semibold">{trip.description}</span></div>}
          </div>
        </div>

        {/* Live Map — high-quality, authoritative monitoring area (hero element) */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2 px-0.5 text-xs text-blue-900/70 tracking-[0.6px]">
            <div>LIVE POSITION + HISTORICAL TRAIL + GEOFENCE ZONES</div>
            <a href={mapsUrl} target="_blank" className="text-blue-700 hover:text-blue-900 font-medium">OPEN IN GOOGLE MAPS ↗</a>
          </div>

          <div className="rounded-3xl overflow-hidden border-[3px] border-blue-300 bg-white shadow-md">
            <TripMap
              pickup={trip.pickup_location}
              dropoff={trip.dropoff_location}
              height={540}
              currentLocation={hasLocation ? { lat: trip.current_lat!, lng: trip.current_lng! } : null}
              currentLocationLabel="Admin: Driver's live location (real-time GPS)"
              historicalPath={historicalPath}
              autoFollow={true}
              simplifyEpsilon={0.00009}
              showLegend={true}
              geofences={[
                ...(pickupCenter ? [{
                  id: 'pickup',
                  label: 'Pickup zone',
                  center: pickupCenter,
                  radiusMeters: DEFAULT_GEOFENCE_RADIUS_METERS,
                  status: geofenceStatuses['pickup'],
                }] : []),
                ...(dropoffCenter ? [{
                  id: 'dropoff',
                  label: 'Dropoff zone',
                  center: dropoffCenter,
                  radiusMeters: DEFAULT_GEOFENCE_RADIUS_METERS,
                  status: geofenceStatuses['dropoff'],
                }] : []),
              ]}
            />
          </div>

          {/* Refined status panel */}
          <div className="mt-3 p-3 bg-white border border-blue-100 rounded-2xl text-sm text-blue-800/90">
            {isLive ? (
              'Real-time tracking active — updates live as the driver moves.'
            ) : trip.status === 'assigned' ? (
              'Trip assigned. Live data will appear when the driver starts.'
            ) : (
              'No current location data yet.'
            )}
            <div className="text-xs text-blue-700/60 mt-1">Last update: {lastUpdateDisplay || 'N/A'} • Read-only</div>
          </div>
        </div>

        {/* Real-time Geofencing — visible, actionable, premium monitoring block */}
        <div className="mb-7">
          <div className="flex items-baseline justify-between mb-2 px-0.5">
            <div className="text-[10px] font-semibold tracking-[0.6px] text-blue-900/70">REAL-TIME GEOFENCE ALERTS</div>
            <div className="text-[10px] text-blue-700/60 font-medium tracking-wide">200 m circular zones around pickup &amp; dropoff • derived from GPS trail</div>
          </div>

          <div className="bg-white border border-blue-200 rounded-3xl p-5 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Pickup Zone */}
              <div className={`rounded-2xl border p-4 transition ${geofenceStatuses['pickup'] === 'inside' ? 'border-emerald-300 bg-emerald-50/40' : 'border-blue-100 bg-white'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold tracking-wider text-blue-900/70">PICKUP ZONE</div>
                    <div className="font-semibold text-blue-950 mt-0.5">{trip.pickup_location}</div>
                  </div>
                  <div className={`text-xs font-bold px-3 py-1 rounded-full border ${geofenceStatuses['pickup'] === 'inside' ? 'bg-emerald-600 text-white border-emerald-700' : 'bg-blue-100 text-blue-800 border-blue-200'}`}>
                    {geofenceStatuses['pickup'] === 'inside' ? 'DRIVER INSIDE' : 'OUTSIDE'}
                  </div>
                </div>
                <div className="mt-2 text-[13px] text-blue-800/80">
                  {geofenceStatuses['pickup'] === 'inside' 
                    ? 'Driver has entered the pickup zone. Monitor for passenger boarding.' 
                    : 'Driver is outside the 200 m pickup radius.'}
                </div>
              </div>

              {/* Dropoff Zone */}
              <div className={`rounded-2xl border p-4 transition ${geofenceStatuses['dropoff'] === 'inside' ? 'border-emerald-300 bg-emerald-50/40' : 'border-blue-100 bg-white'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold tracking-wider text-blue-900/70">DROPOFF ZONE</div>
                    <div className="font-semibold text-blue-950 mt-0.5">{trip.dropoff_location}</div>
                  </div>
                  <div className={`text-xs font-bold px-3 py-1 rounded-full border ${geofenceStatuses['dropoff'] === 'inside' ? 'bg-emerald-600 text-white border-emerald-700' : 'bg-blue-100 text-blue-800 border-blue-200'}`}>
                    {geofenceStatuses['dropoff'] === 'inside' ? 'DRIVER INSIDE' : 'OUTSIDE'}
                  </div>
                </div>
                <div className="mt-2 text-[13px] text-blue-800/80">
                  {geofenceStatuses['dropoff'] === 'inside' 
                    ? 'Driver has entered the dropoff zone. Approaching destination.' 
                    : 'Driver is outside the 200 m dropoff radius.'}
                </div>
              </div>
            </div>

            {/* Geofence event history / trail integration */}
            <div className="mt-4 pt-4 border-t border-blue-100">
              <div className="text-xs font-semibold tracking-wider text-blue-900/70 mb-2">GEOFENCE EVENT HISTORY</div>
              {geofenceEvents.length > 0 ? (
                <div className="space-y-1.5 max-h-[138px] overflow-auto pr-1 text-sm">
                  {[...geofenceEvents].reverse().slice(0, 8).map((ev, idx) => (
                    <div key={idx} className="flex items-start gap-2 rounded-xl bg-blue-50/60 border border-blue-100 px-3 py-1.5">
                      <div className={`mt-0.5 font-mono text-[10px] px-1.5 py-px rounded ${ev.type === 'enter' ? 'bg-emerald-200 text-emerald-800' : 'bg-amber-200 text-amber-800'}`}>
                        {ev.type.toUpperCase()}
                      </div>
                      <div className="text-blue-900">
                        <span className="font-semibold">{ev.zoneLabel}</span> — {ev.type === 'enter' ? 'entered' : 'exited'}
                        <span className="text-blue-700/60 text-xs ml-2 tabular-nums">{new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-blue-700/60">No geofence crossings recorded yet for this trip. Events will appear as the driver moves into or out of zones.</div>
              )}
              {geofenceLoading && <div className="text-[10px] text-blue-600 mt-1">Resolving zone coordinates…</div>}
            </div>
          </div>
        </div>

        <div className="text-[10px] text-blue-700/50 pt-1 tracking-[0.75px] font-medium">READ-ONLY OPERATIONAL MONITORING • GEOFENCING + CLUSTERING ENABLED</div>
      </div>
    </div>
  );
}
