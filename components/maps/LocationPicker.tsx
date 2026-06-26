'use client';

/**
 * Shared pickup / dropoff location picker — Google Places Autocomplete + interactive map.
 * Matches Organization Portal trip creation UX; reusable in Rider wizard and org flows.
 *
 * TODO: Saved addresses / favorites from rider profile
 * TODO: Recent locations history
 * TODO: Reverse-geocode debounce on marker drag
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Autocomplete, DirectionsRenderer, GoogleMap, LoadScript, Marker } from '@react-google-maps/api';

export interface LatLngCoords {
  lat: number;
  lng: number;
}

export interface PickedLocation {
  formattedAddress: string;
  lat: number;
  lng: number;
}

export interface RouteEstimate {
  distanceMiles: number;
  durationMinutes: number;
}

export interface LocationPickerProps {
  pickupAddress: string;
  dropoffAddress: string;
  pickupCoords: LatLngCoords | null;
  dropoffCoords: LatLngCoords | null;
  onPickupChange: (address: string, coords: LatLngCoords | null) => void;
  onDropoffChange: (address: string, coords: LatLngCoords | null) => void;
  /** Fired when both locations are set and driving route is calculated (or cleared). */
  onRouteEstimate?: (estimate: RouteEstimate | null) => void;
  /** Tailwind classes for text inputs (match parent portal styling). */
  inputClassName?: string;
  labelClassName?: string;
  mapHeight?: number;
  /** Show manual recalculate control (Organization Portal style). */
  showRecalculateButton?: boolean;
  /** Section heading override */
  heading?: string;
  helperText?: string;
}

const DEFAULT_CENTER: LatLngCoords = { lat: 39.8283, lng: -98.5795 };
const GOOGLE_LIBRARIES = ['places'] as const;

const defaultInputClass =
  'w-full rounded-xl border border-gray-300 px-4 py-3 text-blue-950 placeholder:text-blue-700 focus:border-[#1E3A8A] focus:outline-none focus:ring-2 focus:ring-blue-200';
const defaultLabelClass = 'block text-sm font-medium text-blue-950 mb-1';

function geocodeLatLng(lat: number, lng: number): Promise<string> {
  return new Promise((resolve) => {
    if (!window.google?.maps) {
      resolve(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      return;
    }
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      if (status === 'OK' && results?.[0]) {
        resolve(results[0].formatted_address);
      } else {
        resolve(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      }
    });
  });
}

function coordsNearlyEqual(a: LatLngCoords, b: LatLngCoords, epsilon = 0.0001): boolean {
  return Math.abs(a.lat - b.lat) < epsilon && Math.abs(a.lng - b.lng) < epsilon;
}

export default function LocationPicker({
  pickupAddress,
  dropoffAddress,
  pickupCoords,
  dropoffCoords,
  onPickupChange,
  onDropoffChange,
  onRouteEstimate,
  inputClassName = defaultInputClass,
  labelClassName = defaultLabelClass,
  mapHeight = 420,
  showRecalculateButton = false,
  heading = 'Pickup & Dropoff Locations',
  helperText = 'Search with autocomplete or tap the map to place pickup (P) then dropoff (D). Drag markers to fine-tune.',
}: LocationPickerProps) {
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [distanceMiles, setDistanceMiles] = useState<number | null>(null);
  const [durationMinutes, setDurationMinutes] = useState<number | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);

  const [pickupAuto, setPickupAuto] = useState<google.maps.places.Autocomplete | null>(null);
  const [dropoffAuto, setDropoffAuto] = useState<google.maps.places.Autocomplete | null>(null);

  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const googleLibraries = useMemo(() => [...GOOGLE_LIBRARIES], []);

  const updateRoute = useCallback(async () => {
    if (!window.google?.maps) return;

    let origin = pickupCoords;
    let destination = dropoffCoords;

    setRouteLoading(true);
    setRouteError(null);

    try {
      const geocoder = new google.maps.Geocoder();

      if (!origin && pickupAddress.trim()) {
        const res = await new Promise<google.maps.GeocoderResult[]>((resolve, reject) => {
          geocoder.geocode(
            { address: pickupAddress.trim(), componentRestrictions: { country: 'US' } },
            (results, status) => (status === 'OK' && results ? resolve(results) : reject(status))
          );
        });
        if (res[0]?.geometry?.location) {
          const loc = res[0].geometry.location;
          origin = { lat: loc.lat(), lng: loc.lng() };
          onPickupChange(res[0].formatted_address || pickupAddress, origin);
        }
      }

      if (!destination && dropoffAddress.trim()) {
        const res = await new Promise<google.maps.GeocoderResult[]>((resolve, reject) => {
          geocoder.geocode(
            { address: dropoffAddress.trim(), componentRestrictions: { country: 'US' } },
            (results, status) => (status === 'OK' && results ? resolve(results) : reject(status))
          );
        });
        if (res[0]?.geometry?.location) {
          const loc = res[0].geometry.location;
          destination = { lat: loc.lat(), lng: loc.lng() };
          onDropoffChange(res[0].formatted_address || dropoffAddress, destination);
        }
      }

      if (!origin || !destination) {
        setDirections(null);
        setDistanceMiles(null);
        setDurationMinutes(null);
        onRouteEstimate?.(null);
        return;
      }

      if (coordsNearlyEqual(origin, destination)) {
        throw new Error('Pickup and drop-off must be different locations.');
      }

      const routeOrigin = origin;
      const routeDestination = destination;

      const directionsService = new google.maps.DirectionsService();
      const result = await new Promise<google.maps.DirectionsResult>((resolve, reject) => {
        directionsService.route(
          {
            origin: routeOrigin,
            destination: routeDestination,
            travelMode: google.maps.TravelMode.DRIVING,
          },
          (res, status) => {
            if (status === google.maps.DirectionsStatus.OK && res) resolve(res);
            else reject(new Error(status || 'Directions request failed'));
          }
        );
      });

      setDirections(result);

      const leg = result.routes[0]?.legs[0];
      const distMiles = leg?.distance ? leg.distance.value / 1609.34 : 0;
      const roundedDist = Math.round(distMiles * 10) / 10;
      const duration = leg?.duration ? Math.round(leg.duration.value / 60) : 0;

      setDistanceMiles(roundedDist);
      setDurationMinutes(duration);
      onRouteEstimate?.({ distanceMiles: roundedDist, durationMinutes: duration });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not calculate route.';
      setRouteError(message);
      setDirections(null);
      setDistanceMiles(null);
      setDurationMinutes(null);
      onRouteEstimate?.(null);
    } finally {
      setRouteLoading(false);
    }
  }, [
    pickupCoords,
    dropoffCoords,
    pickupAddress,
    dropoffAddress,
    onPickupChange,
    onDropoffChange,
    onRouteEstimate,
  ]);

  useEffect(() => {
    if (!mapLoaded) return;

    const timer = setTimeout(() => {
      if (pickupCoords && dropoffCoords) {
        updateRoute();
      } else if (pickupAddress.trim() && dropoffAddress.trim()) {
        // Geocode typed or draft addresses once both fields are filled
        updateRoute();
      } else {
        setDirections(null);
        setDistanceMiles(null);
        setDurationMinutes(null);
        onRouteEstimate?.(null);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [
    mapLoaded,
    pickupCoords,
    dropoffCoords,
    pickupAddress,
    dropoffAddress,
    updateRoute,
    onRouteEstimate,
  ]);

  const handlePickupPlaceChanged = () => {
    if (!pickupAuto) return;
    const place = pickupAuto.getPlace();
    if (place.geometry?.location) {
      const lat = place.geometry.location.lat();
      const lng = place.geometry.location.lng();
      const addr = place.formatted_address || place.name || pickupAddress;
      onPickupChange(addr, { lat, lng });
    }
  };

  const handleDropoffPlaceChanged = () => {
    if (!dropoffAuto) return;
    const place = dropoffAuto.getPlace();
    if (place.geometry?.location) {
      const lat = place.geometry.location.lat();
      const lng = place.geometry.location.lng();
      const addr = place.formatted_address || place.name || dropoffAddress;
      onDropoffChange(addr, { lat, lng });
    }
  };

  const handleMapClick = (event: google.maps.MapMouseEvent) => {
    if (!event.latLng) return;
    const lat = event.latLng.lat();
    const lng = event.latLng.lng();
    const isSettingPickup = !pickupCoords;

    geocodeLatLng(lat, lng).then((addr) => {
      if (isSettingPickup) {
        onPickupChange(addr, { lat, lng });
      } else {
        onDropoffChange(addr, { lat, lng });
      }
    });
  };

  const handlePickupDrag = (event: google.maps.MapMouseEvent) => {
    if (!event.latLng) return;
    const lat = event.latLng.lat();
    const lng = event.latLng.lng();
    geocodeLatLng(lat, lng).then((addr) => onPickupChange(addr, { lat, lng }));
  };

  const handleDropoffDrag = (event: google.maps.MapMouseEvent) => {
    if (!event.latLng) return;
    const lat = event.latLng.lat();
    const lng = event.latLng.lng();
    geocodeLatLng(lat, lng).then((addr) => onDropoffChange(addr, { lat, lng }));
  };

  const clearPickup = () => {
    onPickupChange('', null);
    setDirections(null);
    setDistanceMiles(null);
    setDurationMinutes(null);
    onRouteEstimate?.(null);
  };

  const clearDropoff = () => {
    onDropoffChange('', null);
    setDirections(null);
    setDistanceMiles(null);
    setDurationMinutes(null);
    onRouteEstimate?.(null);
  };

  const clearBoth = () => {
    onPickupChange('', null);
    onDropoffChange('', null);
    setDirections(null);
    setDistanceMiles(null);
    setDurationMinutes(null);
    onRouteEstimate?.(null);
  };

  const mapCenter =
    pickupCoords || dropoffCoords ? (pickupCoords || dropoffCoords)! : DEFAULT_CENTER;
  const mapZoom = pickupCoords && dropoffCoords ? 11 : pickupCoords ? 13 : 4;

  const fallbackInputs = (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
      <div>
        <label className={labelClassName}>Pickup Location</label>
        <input
          type="text"
          value={pickupAddress}
          onChange={(e) => onPickupChange(e.target.value, pickupCoords)}
          className={inputClassName}
          placeholder="123 Oak Street, Chicago, IL 60601"
          autoComplete="street-address"
        />
      </div>
      <div>
        <label className={labelClassName}>Dropoff Location</label>
        <input
          type="text"
          value={dropoffAddress}
          onChange={(e) => onDropoffChange(e.target.value, dropoffCoords)}
          className={inputClassName}
          placeholder="Central High School, Austin, TX 78701"
        />
      </div>
    </div>
  );

  if (!googleMapsApiKey) {
    return (
      <div className="space-y-3">
        <p className="text-xs text-amber-800">
          Google Maps API key is not configured. Enter addresses manually below.
        </p>
        {fallbackInputs}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-2">
        <label className={labelClassName}>{heading}</label>
        <p className="text-xs text-blue-700">{helperText}</p>
      </div>

      <LoadScript
        googleMapsApiKey={googleMapsApiKey}
        libraries={googleLibraries as unknown as ('places')[]}
        onLoad={() => {
          setMapLoaded(true);
          setMapError(null);
        }}
        onError={() => {
          setMapError(
            'Google Maps failed to load. Check API key restrictions (HTTP referrers) in Google Cloud Console.'
          );
          setMapLoaded(false);
        }}
      >
        {mapError ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-red-300 bg-red-50 p-4 text-sm text-red-800">
              <div className="mb-1 font-semibold">Google Maps could not load</div>
              <div>{mapError}</div>
              <button
                type="button"
                onClick={updateRoute}
                disabled={routeLoading || !pickupAddress.trim() || !dropoffAddress.trim()}
                className="mt-3 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {routeLoading ? 'Calculating…' : 'Calculate route from addresses'}
              </button>
            </div>
            {fallbackInputs}
          </div>
        ) : (
          <>
            <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
              <div>
                <label className={labelClassName}>Pickup Location</label>
                <Autocomplete
                  onLoad={setPickupAuto}
                  onPlaceChanged={handlePickupPlaceChanged}
                  options={{ componentRestrictions: { country: 'us' } }}
                >
                  <input
                    type="text"
                    value={pickupAddress}
                    onChange={(e) => onPickupChange(e.target.value, pickupCoords)}
                    className={inputClassName}
                    placeholder="Search pickup address"
                    autoComplete="street-address"
                  />
                </Autocomplete>
                {pickupCoords && (
                  <button
                    type="button"
                    onClick={clearPickup}
                    className="mt-0.5 text-[10px] text-red-600 hover:underline"
                  >
                    Clear pickup
                  </button>
                )}
              </div>
              <div>
                <label className={labelClassName}>Dropoff Location</label>
                <Autocomplete
                  onLoad={setDropoffAuto}
                  onPlaceChanged={handleDropoffPlaceChanged}
                  options={{ componentRestrictions: { country: 'us' } }}
                >
                  <input
                    type="text"
                    value={dropoffAddress}
                    onChange={(e) => onDropoffChange(e.target.value, dropoffCoords)}
                    className={inputClassName}
                    placeholder="Search dropoff address"
                  />
                </Autocomplete>
                {dropoffCoords && (
                  <button
                    type="button"
                    onClick={clearDropoff}
                    className="mt-0.5 text-[10px] text-red-600 hover:underline"
                  >
                    Clear dropoff
                  </button>
                )}
              </div>
            </div>

            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-medium text-blue-950">Map &amp; Route Preview</div>
              {showRecalculateButton && (
                <button
                  type="button"
                  onClick={updateRoute}
                  disabled={routeLoading || !pickupCoords || !dropoffCoords}
                  className="rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {routeLoading ? 'Recalculating…' : 'Recalculate route'}
                </button>
              )}
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-gray-200 shadow-sm">
              {!mapLoaded && (
                <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-gray-50 text-sm text-blue-800">
                  Loading Google Maps…
                </div>
              )}
              <GoogleMap
                mapContainerStyle={{ width: '100%', height: `${mapHeight}px` }}
                center={mapCenter}
                zoom={mapZoom}
                onClick={handleMapClick}
                options={{
                  streetViewControl: false,
                  mapTypeControl: false,
                  fullscreenControl: true,
                  gestureHandling: 'greedy',
                }}
              >
                {pickupCoords && (
                  <Marker
                    position={pickupCoords}
                    draggable
                    onDragEnd={handlePickupDrag}
                    label={{ text: 'P', color: '#fff', fontSize: '14px', fontWeight: '700' }}
                    title="Pickup — drag to adjust"
                  />
                )}
                {dropoffCoords && (
                  <Marker
                    position={dropoffCoords}
                    draggable
                    onDragEnd={handleDropoffDrag}
                    label={{ text: 'D', color: '#fff', fontSize: '14px', fontWeight: '700' }}
                    title="Dropoff — drag to adjust"
                  />
                )}
                {directions && <DirectionsRenderer directions={directions} />}
              </GoogleMap>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              {routeLoading && <span className="text-blue-800">Calculating route…</span>}
              {!routeLoading && distanceMiles !== null && (
                <span className="font-semibold text-blue-950">Distance: {distanceMiles} mi</span>
              )}
              {!routeLoading && durationMinutes !== null && durationMinutes > 0 && (
                <span className="text-blue-800">Est. drive time: ~{durationMinutes} min</span>
              )}
              <button
                type="button"
                onClick={clearBoth}
                className="text-xs text-gray-500 underline hover:text-red-600"
              >
                Clear both locations
              </button>
            </div>

            {routeError && (
              <p className="mt-2 text-sm text-red-600">{routeError}</p>
            )}
          </>
        )}
      </LoadScript>
    </div>
  );
}