'use client';

import { GoogleMap, LoadScript } from '@react-google-maps/api';
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { MarkerClusterer, Renderer } from '@googlemaps/markerclusterer';

interface ActiveTripMarker {
  id: string;
  title: string;
  status: string;
  current_lat: number;
  current_lng: number;
  driver_name?: string;
  organization_name?: string;
}

interface ActiveTripsMapProps {
  trips: ActiveTripMarker[];
  height?: number;
  /** Base path for trip detail navigation. Defaults to admin live map route. */
  tripDetailBasePath?: string;
}

const containerStyle = (height: number) => ({
  width: '100%',
  height: `${height}px`,
});

const defaultCenter = { lat: 37.7749, lng: -122.4194 };

export default function ActiveTripsMap({
  trips,
  height = 420,
  tripDetailBasePath = '/admin/active-trips',
}: ActiveTripsMapProps) {
  const router = useRouter();
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const clustererRef = useRef<MarkerClusterer | null>(null);

  const mappableTrips = trips; // already filtered upstream to those with coords

  const onMapLoad = (map: google.maps.Map) => {
    mapRef.current = map;
    // Initial fit will happen after markers created in effect
  };

  // Create / update markers + clustering when trips change
  useEffect(() => {
    if (!window.google || !mapRef.current) return;

    // Cleanup previous
    if (clustererRef.current) {
      clustererRef.current.clearMarkers();
      clustererRef.current = null;
    }
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    if (mappableTrips.length === 0) return;

    const map = mapRef.current;

    // Build individual markers (for non-clustered view)
    const newMarkers: google.maps.Marker[] = mappableTrips.map((trip) => {
      const isLive = trip.status === 'in_progress';
      const marker = new google.maps.Marker({
        position: { lat: Number(trip.current_lat), lng: Number(trip.current_lng) },
        title: `${trip.title} • ${trip.driver_name || 'Driver'} (${isLive ? 'LIVE' : 'ASSIGNED'})`,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 7.5,
          fillColor: isLive ? '#1E3A8A' : '#64748B',
          fillOpacity: 0.95,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        },
        zIndex: isLive ? 10 : 5,
      });

      // Attach data for cluster renderer
      (marker as any).tripId = trip.id;
      (marker as any).tripStatus = trip.status;
      (marker as any).tripTitle = trip.title;

      // Click navigates to detail page for this trip
      marker.addListener('click', () => {
        router.push(`${tripDetailBasePath}/${trip.id}`);
      });

      marker.setMap(map);
      return marker;
    });

    markersRef.current = newMarkers;

    // Custom renderer for clusters: shows count + subtle status awareness
    const clusterRenderer: Renderer = {
      render: ({ count, position, markers }) => {
        const liveInCluster = (markers || []).filter((m: any) => (m as any).tripStatus === 'in_progress').length;
        const hasLive = liveInCluster > 0;
        const pctLive = Math.round((liveInCluster / count) * 100);

        // Scale cluster a little with count, authoritative dark blue when live present
        const baseScale = Math.min(22, 15 + Math.floor(Math.log2(count) * 1.6));
        const fill = hasLive ? '#1E3A8A' : '#475569';
        const stroke = hasLive ? '#1E40AF' : '#334155';

        const clusterMarker = new google.maps.Marker({
          position,
          label: {
            text: String(count),
            color: '#ffffff',
            fontSize: count > 99 ? '11px' : '12.5px',
            fontWeight: '700',
          },
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            fillColor: fill,
            fillOpacity: 0.92,
            strokeColor: '#ffffff',
            strokeWeight: 2.5,
            scale: baseScale,
          },
          zIndex: 20,
          title: `${count} trips${hasLive ? ` (${pctLive}% live)` : ''} — click to expand`,
        });

        // Clicking cluster will auto zoom (handled by MarkerClusterer). We can also add explicit behavior if wanted.
        return clusterMarker;
      },
    };

    const clusterer = new MarkerClusterer({
      markers: newMarkers,
      map,
      renderer: clusterRenderer,
      // Reasonable behavior for operational monitoring
      algorithmOptions: { maxZoom: 15 }, // allow individuals at close zoom
    });

    clustererRef.current = clusterer;

    // Fit bounds to show all markers nicely on first render / major changes
    if (newMarkers.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      newMarkers.forEach((m) => bounds.extend(m.getPosition()!));
      // Slight padding
      map.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 });

      // If very few points, don't overzoom too much
      const listener = google.maps.event.addListenerOnce(map, 'idle', () => {
        if (map.getZoom()! > 16) map.setZoom(16);
      });
      // Clean listener shortly after (one-time)
      setTimeout(() => {
        try { google.maps.event.removeListener(listener); } catch {}
      }, 1200);
    }

    return () => {
      // Cleanup on unmount or trips change
      if (clustererRef.current) {
        clustererRef.current.clearMarkers();
        clustererRef.current = null;
      }
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];
    };
  }, [mappableTrips, router, tripDetailBasePath]);

  if (mappableTrips.length === 0) {
    return (
      <div className="rounded-3xl border border-blue-200 bg-white p-8 text-center shadow-sm" style={{ height: `${height}px` }}>
        <div className="text-blue-900/70 text-sm tracking-wider font-semibold mb-1">LIVE POSITIONS</div>
        <div className="text-blue-950 font-medium">No live GPS positions yet for current filter.</div>
        <div className="text-blue-700/60 text-xs mt-1">Positions appear once drivers start moving on assigned trips.</div>
      </div>
    );
  }

  return (
    <div className="relative rounded-3xl overflow-hidden border-[3px] border-blue-300 bg-white shadow-md">
      <LoadScript googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}>
        <GoogleMap
          mapContainerStyle={containerStyle(height)}
          center={defaultCenter}
          zoom={9}
          onLoad={onMapLoad}
          options={{
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: true,
            zoomControl: true,
          }}
        />
      </LoadScript>

      {/* Premium map overlay header for the operations map */}
      <div className="absolute top-3 left-3 z-[999] bg-white/95 backdrop-blur border border-blue-200 rounded-2xl px-3.5 py-1.5 text-[10px] font-semibold tracking-[0.5px] text-blue-900/90 shadow-sm">
        LIVE TRIPS MAP — CLUSTERED
        <span className="ml-2 text-blue-700/60 font-medium">({mappableTrips.length} positioned)</span>
      </div>

      <div className="absolute bottom-3 right-3 z-[999] bg-white/95 backdrop-blur border border-blue-200 rounded-2xl px-3 py-1 text-[9px] text-blue-800/80 shadow-sm font-medium">
        Click cluster to zoom • Click marker for details
      </div>
    </div>
  );
}
