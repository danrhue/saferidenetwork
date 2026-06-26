'use client';

import { GoogleMap, LoadScript, DirectionsRenderer, Marker, Polyline, Circle } from '@react-google-maps/api';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { simplifyPath, type LatLngPoint } from '@/lib/simplify-path';

export interface LatLngCoords {
  lat: number;
  lng: number;
}

interface TripMapProps {
  pickup: string;
  dropoff: string;
  /** Precise pickup coordinates from trip record (preferred over geocoding addresses) */
  pickupCoords?: LatLngCoords | null;
  /** Precise dropoff coordinates from trip record */
  dropoffCoords?: LatLngCoords | null;
  /** Show labeled A/B markers at pickup and dropoff when coordinates are available */
  showPickupDropoffMarkers?: boolean;
  height?: number;
  currentLocation?: LatLngCoords | null;
  currentLocationLabel?: string;
  historicalPath?: LatLngCoords[];
  autoFollow?: boolean;
  simplifyEpsilon?: number;
  showLegend?: boolean;
  geofences?: Array<{
    id: string;
    label: string;
    center: LatLngCoords;
    radiusMeters: number;
    status?: 'inside' | 'outside';
  }>;
}

const containerStyle = (height: number) => ({
  width: '100%',
  height: `${height}px`,
  borderRadius: '12px',
});

// Continental US fallback only when no trip data is available
const defaultCenter: LatLngCoords = { lat: 39.8283, lng: -98.5795 };

const GOOGLE_LIBRARIES: ('places')[] = ['places'];

function isValidCoord(coords?: LatLngCoords | null): coords is LatLngCoords {
  return (
    !!coords &&
    typeof coords.lat === 'number' &&
    typeof coords.lng === 'number' &&
    !Number.isNaN(coords.lat) &&
    !Number.isNaN(coords.lng)
  );
}

function midpoint(a: LatLngCoords, b: LatLngCoords): LatLngCoords {
  return { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 };
}

export default function TripMap({
  pickup,
  dropoff,
  pickupCoords = null,
  dropoffCoords = null,
  showPickupDropoffMarkers = true,
  height = 300,
  currentLocation = null,
  currentLocationLabel,
  historicalPath = [],
  autoFollow = false,
  simplifyEpsilon = 0.00009,
  showLegend = false,
  geofences = [],
}: TripMapProps) {
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [mapsReady, setMapsReady] = useState(false);
  const mapRef = useRef<google.maps.Map | null>(null);

  const hasPickupCoord = isValidCoord(pickupCoords);
  const hasDropoffCoord = isValidCoord(dropoffCoords);
  const hasBothCoords = hasPickupCoord && hasDropoffCoord;

  const mapCenter = useMemo((): LatLngCoords => {
    if (hasBothCoords) return midpoint(pickupCoords!, dropoffCoords!);
    if (hasPickupCoord) return pickupCoords!;
    if (hasDropoffCoord) return dropoffCoords!;
    if (currentLocation) return currentLocation;
    return defaultCenter;
  }, [hasBothCoords, hasPickupCoord, hasDropoffCoord, pickupCoords, dropoffCoords, currentLocation]);

  const fitMapToTrip = useCallback(() => {
    if (!mapRef.current || typeof window === 'undefined' || !window.google?.maps) return;

    if (directions?.routes?.[0]?.bounds) {
      mapRef.current.fitBounds(directions.routes[0].bounds, 48);
      return;
    }

    if (hasBothCoords) {
      const bounds = new window.google.maps.LatLngBounds();
      bounds.extend(pickupCoords!);
      bounds.extend(dropoffCoords!);
      mapRef.current.fitBounds(bounds, 48);
    } else if (hasPickupCoord) {
      mapRef.current.setCenter(pickupCoords!);
      mapRef.current.setZoom(14);
    } else if (hasDropoffCoord) {
      mapRef.current.setCenter(dropoffCoords!);
      mapRef.current.setZoom(14);
    }
  }, [directions, hasBothCoords, hasPickupCoord, hasDropoffCoord, pickupCoords, dropoffCoords]);

  // Fetch driving directions once Google Maps API is ready
  useEffect(() => {
    if (!mapsReady || !window.google?.maps) return;
    if (!pickup && !hasPickupCoord) return;
    if (!dropoff && !hasDropoffCoord) return;

    const directionsService = new window.google.maps.DirectionsService();
    const origin: google.maps.LatLngLiteral | string = hasPickupCoord
      ? { lat: pickupCoords!.lat, lng: pickupCoords!.lng }
      : pickup;
    const destination: google.maps.LatLngLiteral | string = hasDropoffCoord
      ? { lat: dropoffCoords!.lat, lng: dropoffCoords!.lng }
      : dropoff;

    directionsService.route(
      {
        origin,
        destination,
        travelMode: window.google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === window.google.maps.DirectionsStatus.OK && result) {
          setDirections(result);
          setRouteError(null);
        } else {
          setDirections(null);
          setRouteError(
            hasBothCoords
              ? 'Driving route unavailable — showing pickup and dropoff markers.'
              : 'Could not calculate route. Check the addresses or coordinates.'
          );
        }
      }
    );
  }, [
    mapsReady,
    pickup,
    dropoff,
    pickupCoords,
    dropoffCoords,
    hasPickupCoord,
    hasDropoffCoord,
    hasBothCoords,
  ]);

  useEffect(() => {
    fitMapToTrip();
  }, [fitMapToTrip, directions]);

  useEffect(() => {
    if (autoFollow && mapRef.current && currentLocation) {
      mapRef.current.panTo(currentLocation);
    }
  }, [currentLocation, autoFollow]);

  const onMapLoad = (map: google.maps.Map) => {
    mapRef.current = map;
    if (currentLocation && autoFollow) {
      map.setCenter(currentLocation);
    } else {
      fitMapToTrip();
    }
  };

  const simplifiedHistoricalPath = useMemo(() => {
    if (!historicalPath || historicalPath.length <= 2) {
      return historicalPath || [];
    }
    return simplifyPath(historicalPath as LatLngPoint[], {
      epsilon: simplifyEpsilon,
      maxPoints: 350,
    });
  }, [historicalPath, simplifyEpsilon]);

  const recentSegmentLength = 8;
  const fullHistoricalPath = simplifiedHistoricalPath;
  const recentPath = useMemo(() => {
    if (!fullHistoricalPath || fullHistoricalPath.length <= recentSegmentLength)
      return fullHistoricalPath || [];
    return fullHistoricalPath.slice(-recentSegmentLength);
  }, [fullHistoricalPath]);

  const trailOptions = useMemo((): google.maps.PolylineOptions => {
    const base: google.maps.PolylineOptions = {
      strokeColor: '#1E3A8A',
      strokeOpacity: 0.96,
      strokeWeight: 5,
      geodesic: true,
    };
    if (typeof window !== 'undefined' && window.google?.maps?.SymbolPath) {
      base.icons = [
        {
          icon: {
            path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
            scale: 1.8,
            strokeColor: '#1E3A8A',
            fillColor: '#1E3A8A',
            fillOpacity: 0.9,
          },
          offset: '100%',
          repeat: '120px',
        },
      ];
    }
    return base;
  }, []);

  const shadowOptions = {
    strokeColor: '#0F172A',
    strokeOpacity: 0.08,
    strokeWeight: 14,
    geodesic: true,
  };

  const glowOptions = {
    strokeColor: '#1E40AF',
    strokeOpacity: 0.18,
    strokeWeight: 9,
    geodesic: true,
  };

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return (
      <div
        className="bg-gray-100 border border-gray-200 rounded-xl p-4 text-sm text-gray-600 flex items-center justify-center"
        style={{ height: `${height}px` }}
      >
        Google Maps API key not configured.
      </div>
    );
  }

  if (!pickup && !hasPickupCoord && !dropoff && !hasDropoffCoord) {
    return (
      <div
        className="bg-gray-100 border border-gray-200 rounded-xl p-4 text-sm text-gray-600 flex items-center justify-center"
        style={{ height: `${height}px` }}
      >
        No location data available for this trip.
      </div>
    );
  }

  return (
    <LoadScript
      googleMapsApiKey={apiKey}
      libraries={GOOGLE_LIBRARIES}
      onLoad={() => setMapsReady(true)}
    >
      <div className="relative">
        {routeError && (
          <div className="absolute top-2 left-2 right-2 z-10 bg-amber-50 border border-amber-200 text-amber-900 text-xs px-3 py-2 rounded-lg shadow-sm">
            {routeError}
          </div>
        )}

        <GoogleMap
          mapContainerStyle={containerStyle(height)}
          center={mapCenter}
          zoom={hasBothCoords ? 12 : 10}
          onLoad={onMapLoad}
        >
          {directions && (
            <DirectionsRenderer
              directions={directions}
              options={{ suppressMarkers: showPickupDropoffMarkers && hasBothCoords }}
            />
          )}

          {/* Fallback straight line when directions fail but coords exist */}
          {!directions && hasBothCoords && (
            <Polyline
              path={[pickupCoords!, dropoffCoords!]}
              options={{
                strokeColor: '#1E3A8A',
                strokeOpacity: 0.7,
                strokeWeight: 4,
                geodesic: true,
              }}
            />
          )}

          {/* Pickup marker — A */}
          {showPickupDropoffMarkers && hasPickupCoord && mapsReady && (
            <Marker
              position={pickupCoords!}
              title={`Pickup: ${pickup || 'Pickup location'}`}
              label={{ text: 'A', color: '#ffffff', fontWeight: 'bold' }}
              icon={{
                path: window.google.maps.SymbolPath.CIRCLE,
                scale: 11,
                fillColor: '#16a34a',
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 2,
              }}
            />
          )}

          {/* Dropoff marker — B */}
          {showPickupDropoffMarkers && hasDropoffCoord && mapsReady && (
            <Marker
              position={dropoffCoords!}
              title={`Dropoff: ${dropoff || 'Dropoff location'}`}
              label={{ text: 'B', color: '#ffffff', fontWeight: 'bold' }}
              icon={{
                path: window.google.maps.SymbolPath.CIRCLE,
                scale: 11,
                fillColor: '#dc2626',
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 2,
              }}
            />
          )}

          {fullHistoricalPath && fullHistoricalPath.length > 1 && (
            <>
              <Polyline path={fullHistoricalPath} options={shadowOptions} />
              <Polyline
                path={fullHistoricalPath}
                options={{ ...glowOptions, strokeOpacity: 0.12 }}
              />
              <Polyline
                path={fullHistoricalPath}
                options={{ ...trailOptions, strokeOpacity: 0.45, icons: [] }}
              />
            </>
          )}

          {recentPath && recentPath.length > 1 && (
            <>
              <Polyline path={recentPath} options={shadowOptions} />
              <Polyline path={recentPath} options={glowOptions} />
              <Polyline path={recentPath} options={trailOptions} />
            </>
          )}

          {currentLocation && (
            <Marker
              position={currentLocation}
              title={currentLocationLabel || "Driver's live location (real-time GPS)"}
            />
          )}

          {geofences.map((gf) => {
            const isInside = gf.status === 'inside';
            return (
              <Circle
                key={gf.id}
                center={gf.center}
                radius={gf.radiusMeters}
                options={{
                  strokeColor: isInside ? '#166534' : '#1E3A8A',
                  strokeOpacity: 0.65,
                  strokeWeight: 2,
                  fillColor: isInside ? '#166534' : '#1E40AF',
                  fillOpacity: isInside ? 0.09 : 0.055,
                }}
              />
            );
          })}
        </GoogleMap>

        {showLegend && (
          <div className="absolute bottom-3 left-3 z-[999] bg-white/95 backdrop-blur-sm border border-blue-200 rounded-2xl px-3.5 py-2.5 text-[10px] shadow-sm max-w-[232px] font-medium text-blue-900/90">
            <div className="text-[8px] tracking-[0.5px] text-blue-900/70 mb-1 font-semibold">
              MAP LEGEND
            </div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-3 h-3 rounded-full bg-green-600" />
              <span>A = Pickup</span>
            </div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-3 h-3 rounded-full bg-red-600" />
              <span>B = Dropoff</span>
            </div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-5 h-[2.5px] bg-[#1E3A8A] rounded-full" />
              <span>Route / trail</span>
            </div>
            {geofences.length > 0 && (
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full border border-[#1E3A8A]/70 bg-[#1E40AF]/10" />
                <span>Geofence zones</span>
              </div>
            )}
          </div>
        )}
      </div>
    </LoadScript>
  );
}