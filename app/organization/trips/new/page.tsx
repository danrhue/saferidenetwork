'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { authFetch } from '@/lib/auth-fetch';
import { calculateTripPrice, PriceBreakdown } from '@/lib/pricing';
import { GoogleMap, LoadScript, Marker, DirectionsRenderer, Autocomplete } from '@react-google-maps/api';

export default function PostTrip() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    pickup_location: '',
    dropoff_location: '',
    pickup_time: '',
    price: '',
    passengers: '1',
  });
  const [breakdown, setBreakdown] = useState<PriceBreakdown | null>(null);
  const [distanceLoading, setDistanceLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // New map picker state
  const [pickupCoords, setPickupCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [dropoffCoords, setDropoffCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [distanceMiles, setDistanceMiles] = useState<number | null>(null);
  const [pickupAuto, setPickupAuto] = useState<any>(null);
  const [dropoffAuto, setDropoffAuto] = useState<any>(null);

  // Map loading / error states for stability and better UX
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  // Stable libraries array using useMemo prevents unnecessary LoadScript reloads
  // and the "LoadScript has been reloaded unintentionally" warning.
  const googleLibraries = useMemo(() => ['places'], []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // --- New Google Maps Location Picker helpers ---

  const geocodeLatLng = (lat: number, lng: number): Promise<string> => {
    return new Promise((resolve) => {
      if (!window.google?.maps) {
        resolve(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
        return;
      }
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        if (status === 'OK' && results && results[0]) {
          resolve(results[0].formatted_address);
        } else {
          resolve(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
        }
      });
    });
  };

  const updateRouteAndPrice = async () => {
    if (!window.google?.maps) {
      setError('Google Maps is still loading. Please wait a moment and try again.');
      return;
    }

    let origin = pickupCoords;
    let destination = dropoffCoords;

    setDistanceLoading(true);
    setError('');

    try {
      // Fallback: if no coords but user typed addresses (supports manual edits), geocode them
      const geocoder = new google.maps.Geocoder();

      if (!origin && formData.pickup_location) {
        const res = await new Promise<google.maps.GeocoderResult[]>((resolve, reject) => {
          geocoder.geocode(
            { address: formData.pickup_location, componentRestrictions: { country: 'US' } },
            (results, status) => (status === 'OK' && results ? resolve(results) : reject(status))
          );
        });
        if (res[0]?.geometry?.location) {
          const loc = res[0].geometry.location;
          origin = { lat: loc.lat(), lng: loc.lng() };
          setPickupCoords(origin);
          // Optionally update address to the nicely formatted one
          if (res[0].formatted_address) {
            setFormData((p) => ({ ...p, pickup_location: res[0].formatted_address }));
          }
        }
      }

      if (!destination && formData.dropoff_location) {
        const res = await new Promise<google.maps.GeocoderResult[]>((resolve, reject) => {
          geocoder.geocode(
            { address: formData.dropoff_location, componentRestrictions: { country: 'US' } },
            (results, status) => (status === 'OK' && results ? resolve(results) : reject(status))
          );
        });
        if (res[0]?.geometry?.location) {
          const loc = res[0].geometry.location;
          destination = { lat: loc.lat(), lng: loc.lng() };
          setDropoffCoords(destination);
          if (res[0].formatted_address) {
            setFormData((p) => ({ ...p, dropoff_location: res[0].formatted_address }));
          }
        }
      }

      if (!origin || !destination) {
        throw new Error('Please provide both pickup and dropoff (use search, map click, or type and recalculate).');
      }

      const directionsService = new google.maps.DirectionsService();

      const result = await new Promise<google.maps.DirectionsResult>((resolve, reject) => {
        directionsService.route(
          {
            origin: origin!,
            destination: destination!,
            travelMode: google.maps.TravelMode.DRIVING,
          },
          (res, status) => {
            if (status === google.maps.DirectionsStatus.OK && res) {
              resolve(res);
            } else {
              reject(new Error(status || 'Directions request failed'));
            }
          }
        );
      });

      setDirections(result);

      const leg = result.routes[0]?.legs[0];
      const distMiles = leg?.distance ? leg.distance.value / 1609.34 : 0;
      const roundedDist = Math.round(distMiles * 10) / 10;

      setDistanceMiles(roundedDist);

      const pickupDate = formData.pickup_time ? new Date(formData.pickup_time) : new Date();
      const priceCalc = await calculateTripPrice(roundedDist, pickupDate);

      setBreakdown(priceCalc);
      setFormData((prev) => ({ ...prev, price: priceCalc.subtotal.toString() }));
    } catch (err: any) {
      console.error('Route/price calculation error:', err);
      setError(err.message || 'Could not calculate route or price. Please check the addresses and try again.');
      setDirections(null);
    } finally {
      setDistanceLoading(false);
    }
  };

  // Auto-calculate route + price when both locations are selected (or pickup time changes)
  useEffect(() => {
    if (pickupCoords && dropoffCoords) {
      const timer = setTimeout(() => {
        updateRouteAndPrice();
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [pickupCoords, dropoffCoords, formData.pickup_time]);

  // Autocomplete handlers
  const handlePickupPlaceChanged = () => {
    if (!pickupAuto) return;
    const place = pickupAuto.getPlace();
    if (place.geometry?.location) {
      const lat = place.geometry.location.lat();
      const lng = place.geometry.location.lng();
      const addr = place.formatted_address || place.name || formData.pickup_location;
      setFormData((prev) => ({ ...prev, pickup_location: addr }));
      setPickupCoords({ lat, lng });
    }
  };

  const handleDropoffPlaceChanged = () => {
    if (!dropoffAuto) return;
    const place = dropoffAuto.getPlace();
    if (place.geometry?.location) {
      const lat = place.geometry.location.lat();
      const lng = place.geometry.location.lng();
      const addr = place.formatted_address || place.name || formData.dropoff_location;
      setFormData((prev) => ({ ...prev, dropoff_location: addr }));
      setDropoffCoords({ lat, lng });
    }
  };

  // Map interactions
  const handleMapClick = (event: google.maps.MapMouseEvent) => {
    if (!event.latLng) return;
    const lat = event.latLng.lat();
    const lng = event.latLng.lng();

    // If no pickup yet, set pickup; otherwise set/update dropoff
    const isSettingPickup = !pickupCoords;

    geocodeLatLng(lat, lng).then((addr) => {
      if (isSettingPickup) {
        setFormData((prev) => ({ ...prev, pickup_location: addr }));
        setPickupCoords({ lat, lng });
      } else {
        setFormData((prev) => ({ ...prev, dropoff_location: addr }));
        setDropoffCoords({ lat, lng });
      }
    });
  };

  const handlePickupDrag = (event: google.maps.MapMouseEvent) => {
    if (!event.latLng) return;
    const lat = event.latLng.lat();
    const lng = event.latLng.lng();
    setPickupCoords({ lat, lng });
    geocodeLatLng(lat, lng).then((addr) => {
      setFormData((prev) => ({ ...prev, pickup_location: addr }));
    });
  };

  const handleDropoffDrag = (event: google.maps.MapMouseEvent) => {
    if (!event.latLng) return;
    const lat = event.latLng.lat();
    const lng = event.latLng.lng();
    setDropoffCoords({ lat, lng });
    geocodeLatLng(lat, lng).then((addr) => {
      setFormData((prev) => ({ ...prev, dropoff_location: addr }));
    });
  };

  // Clear helpers
  const clearPickup = () => {
    setPickupCoords(null);
    setFormData((prev) => ({ ...prev, pickup_location: '' }));
    setDirections(null);
    setDistanceMiles(null);
    if (!dropoffCoords) setBreakdown(null);
  };

  const clearDropoff = () => {
    setDropoffCoords(null);
    setFormData((prev) => ({ ...prev, dropoff_location: '' }));
    setDirections(null);
    setDistanceMiles(null);
    if (!pickupCoords) setBreakdown(null);
  };

  const clearBoth = () => {
    setPickupCoords(null);
    setDropoffCoords(null);
    setDirections(null);
    setDistanceMiles(null);
    setBreakdown(null);
    setFormData((prev) => ({ ...prev, pickup_location: '', dropoff_location: '' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const finalPrice = parseFloat(formData.price);
      if (!finalPrice || finalPrice <= 0) {
        throw new Error('Please enter a valid price');
      }

      if (!formData.pickup_location.trim() || !formData.dropoff_location.trim()) {
        throw new Error('Please select pickup and dropoff locations on the map');
      }

      // Single API call: server creates trip in Supabase, then Stripe Checkout session.
      // Avoids client-side insert + server lookup race and RLS mismatches.
      const tripPayload: Record<string, unknown> = {
        title: formData.title,
        description: formData.description || null,
        pickup_location: formData.pickup_location,
        dropoff_location: formData.dropoff_location,
        pickup_time: formData.pickup_time,
        price: finalPrice,
        final_price: finalPrice,
        passengers: parseInt(formData.passengers) || 1,
      };

      if (pickupCoords) {
        tripPayload.start_lat = pickupCoords.lat;
        tripPayload.start_lng = pickupCoords.lng;
      }
      if (dropoffCoords) {
        tripPayload.end_lat = dropoffCoords.lat;
        tripPayload.end_lng = dropoffCoords.lng;
      }

      if (breakdown) {
        tripPayload.distance_miles = breakdown.distanceMiles;
        tripPayload.base_price = breakdown.basePrice;
        tripPayload.peak_multiplier = breakdown.peakMultiplier;
        tripPayload.calculated_price = breakdown.subtotal;
        tripPayload.platform_fee = breakdown.platformFee;
        tripPayload.total_price = breakdown.totalPrice;
      }

      const response = await authFetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        body: JSON.stringify({
          chargeType: 'driver_compensation',
          trip: tripPayload,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const detail = data.details ? ` (${data.details})` : '';
        throw new Error((data.error || `Checkout failed (${response.status})`) + detail);
      }

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('Stripe did not return a checkout URL. Please try again.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to post trip');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <Link href="/organization/trips" className="text-sm text-blue-900 hover:underline">← Back to My Trips</Link>
        <h1 className="text-3xl font-bold text-blue-950 mt-2">Post a New Trip</h1>
        <p className="text-blue-800 mt-1">Use the map below to pick pickup &amp; dropoff. Route, distance, and suggested price calculate automatically.</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-blue-950 mb-1">Trip Title *</label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-blue-950 placeholder:text-blue-700"
              placeholder="Morning school run - North to Central High"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-blue-950 mb-1">Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={3}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-blue-950 placeholder:text-blue-700"
              placeholder="Daily pickup for 4 students. Reliable driver needed."
            />
          </div>

          {/* NEW: Google Maps Location Picker with Autocomplete + interactive map */}
          <div>
            <div className="mb-2">
              <label className="block text-sm font-medium text-blue-950">Pickup &amp; Dropoff Locations *</label>
              <p className="text-xs text-blue-700">Search with autocomplete or click/drag on the map below. Price calculates automatically.</p>
            </div>

            {googleMapsApiKey ? (
              <LoadScript
                googleMapsApiKey={googleMapsApiKey}
                libraries={googleLibraries as any}
                onLoad={() => {
                  setMapLoaded(true);
                  setMapError(null);
                }}
                onError={(err) => {
                  console.error('Google Maps LoadScript error:', err);
                  setMapError(
                    'Google Maps failed to load. Common cause: API key restrictions (RefererNotAllowedMapError). ' +
                    'Go to Google Cloud Console → APIs & Services → Credentials → edit the key and ensure HTTP referrers allow this domain (or use unrestricted for testing).'
                  );
                  setMapLoaded(false);
                }}
              >
                {mapError ? (
                  /* Clear error UI with fallback to manual entry */
                  <div className="space-y-4">
                    <div className="bg-red-50 border border-red-300 rounded-2xl p-4 text-sm text-red-800">
                      <div className="font-semibold mb-1">⚠️ Google Maps could not load</div>
                      <div>{mapError}</div>
                      <div className="mt-2 text-xs text-red-700">
                        The interactive map is unavailable. Manually enter addresses below, then use the Recalculate button.
                      </div>
                      <button
                        type="button"
                        onClick={updateRouteAndPrice}
                        disabled={distanceLoading || !formData.pickup_location || !formData.dropoff_location}
                        className="mt-3 px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium disabled:opacity-50"
                      >
                        {distanceLoading ? '⏳ Calculating...' : 'Recalculate Price from Addresses'}
                      </button>
                    </div>

                    {/* Manual fallback inputs when map fails */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-blue-950 mb-1">Pickup Location *</label>
                        <input
                          type="text"
                          name="pickup_location"
                          value={formData.pickup_location}
                          onChange={handleChange}
                          className="w-full border border-gray-300 rounded-xl px-4 py-3 text-blue-950 placeholder:text-blue-700"
                          placeholder="123 Oak Street, Chicago, IL 60601"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-blue-950 mb-1">Dropoff Location *</label>
                        <input
                          type="text"
                          name="dropoff_location"
                          value={formData.dropoff_location}
                          onChange={handleChange}
                          className="w-full border border-gray-300 rounded-xl px-4 py-3 text-blue-950 placeholder:text-blue-700"
                          placeholder="Central High School, Austin, TX 78701"
                          required
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Autocomplete search boxes */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                      <div>
                        <label className="block text-sm font-medium text-blue-950 mb-1">Pickup Location</label>
                        <Autocomplete
                          onLoad={setPickupAuto}
                          onPlaceChanged={handlePickupPlaceChanged}
                          options={{ componentRestrictions: { country: 'us' } }}
                        >
                          <input
                            type="text"
                            name="pickup_location"
                            value={formData.pickup_location}
                            onChange={handleChange}
                            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-blue-950 placeholder:text-blue-700"
                            placeholder="Search pickup address or school"
                            required
                          />
                        </Autocomplete>
                        {pickupCoords && (
                          <button
                            type="button"
                            onClick={clearPickup}
                            className="text-[10px] text-red-600 hover:underline mt-0.5"
                          >
                            Clear pickup
                          </button>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-blue-950 mb-1">Dropoff Location</label>
                        <Autocomplete
                          onLoad={setDropoffAuto}
                          onPlaceChanged={handleDropoffPlaceChanged}
                          options={{ componentRestrictions: { country: 'us' } }}
                        >
                          <input
                            type="text"
                            name="dropoff_location"
                            value={formData.dropoff_location}
                            onChange={handleChange}
                            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-blue-950 placeholder:text-blue-700"
                            placeholder="Search dropoff address or school"
                            required
                          />
                        </Autocomplete>
                        {dropoffCoords && (
                          <button
                            type="button"
                            onClick={clearDropoff}
                            className="text-[10px] text-red-600 hover:underline mt-0.5"
                          >
                            Clear dropoff
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Interactive Map */}
                    <div className="mb-2 flex items-center justify-between">
                      <div className="text-sm font-medium text-blue-950">Map Picker &amp; Route Preview</div>
                      <button
                        type="button"
                        onClick={updateRouteAndPrice}
                        disabled={distanceLoading || !pickupCoords || !dropoffCoords}
                        className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium disabled:opacity-50"
                      >
                        {distanceLoading ? '⏳ Recalculating...' : 'Recalculate Price'}
                      </button>
                    </div>

                    <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm relative">
                      {!mapLoaded && (
                        <div className="absolute inset-0 z-10 bg-gray-50 flex items-center justify-center text-sm text-blue-800 rounded-2xl">
                          Loading Google Maps...
                        </div>
                      )}
                      <GoogleMap
                        mapContainerStyle={{ width: '100%', height: '420px' }}
                        center={
                          pickupCoords || dropoffCoords
                            ? (pickupCoords || dropoffCoords)!
                            : { lat: 39.8283, lng: -98.5795 }
                        }
                        zoom={pickupCoords && dropoffCoords ? 11 : pickupCoords ? 13 : 4}
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
                            title="Pickup location — drag to fine-tune"
                          />
                        )}
                        {dropoffCoords && (
                          <Marker
                            position={dropoffCoords}
                            draggable
                            onDragEnd={handleDropoffDrag}
                            label={{ text: 'D', color: '#fff', fontSize: '14px', fontWeight: '700' }}
                            title="Dropoff location — drag to fine-tune"
                          />
                        )}
                        {directions && <DirectionsRenderer directions={directions} />}
                      </GoogleMap>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                      {distanceMiles !== null && (
                        <span className="font-semibold text-blue-950">
                          Distance: {distanceMiles} miles
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={clearBoth}
                        className="text-xs text-gray-500 hover:text-red-600 underline"
                      >
                        Clear both locations
                      </button>
                      <span className="text-xs text-blue-700">Tip: Search above or click the map to place P then D. Drag markers to adjust.</span>
                    </div>
                  </>
                )}
              </LoadScript>
            ) : (
              /* Fallback plain inputs if no Maps key */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-blue-950 mb-1">Pickup Location *</label>
                  <input
                    type="text"
                    name="pickup_location"
                    value={formData.pickup_location}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-blue-950 placeholder:text-blue-700"
                    placeholder="123 Oak Street, Chicago, IL 60601"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-blue-950 mb-1">Dropoff Location *</label>
                  <input
                    type="text"
                    name="dropoff_location"
                    value={formData.dropoff_location}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-blue-950 placeholder:text-blue-700"
                    placeholder="Central High School, Austin, TX 78701"
                    required
                  />
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-blue-950 mb-1">Pickup Time *</label>
              <input
                type="datetime-local"
                name="pickup_time"
                value={formData.pickup_time}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-blue-950 placeholder:text-blue-700"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-blue-950 mb-1">Compensation / Price (USD) *</label>
              <input
                type="number"
                name="price"
                value={formData.price}
                onChange={handleChange}
                step="0.01"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-blue-950 placeholder:text-blue-700"
                placeholder="Auto-filled from map selection"
                required
              />
              <p className="text-[10px] text-blue-700 mt-1">Price is suggested automatically when both locations are set on the map (base $2.50/mi + peak). You can edit.</p>
            </div>
          </div>

          {/* Passengers row (full width) */}
          <div>
            <label className="block text-sm font-medium text-blue-950 mb-1">Number of Passengers</label>
            <select
              name="passengers"
              value={formData.passengers}
              onChange={handleChange as any}
              className="w-full md:w-64 border border-gray-300 rounded-xl px-4 py-3 text-blue-950"
            >
              <option value="1">1 passenger</option>
              <option value="2">2 passengers</option>
              <option value="3">3 passengers</option>
              <option value="4">4 passengers</option>
              <option value="5">5 passengers</option>
              <option value="6">6+ passengers</option>
            </select>
          </div>

          {breakdown && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-900">
              <div className="font-medium mb-1">Price Breakdown</div>
              <div className="space-y-0.5">
                <div>Distance: {breakdown.distanceMiles} miles @ ${breakdown.baseRatePerMile}/mile</div>
                <div>Base cost: ${breakdown.basePrice}</div>
                {breakdown.isPeakTime && (
                  <div>Peak time adjustment (+35%): +${breakdown.peakAdjustment}</div>
                )}
                <div className="pt-1 border-t border-blue-200 font-medium">Driver compensation: ${breakdown.subtotal}</div>
                <div>Platform fee (15%): ${breakdown.platformFee}</div>
                <div className="font-semibold text-base pt-1 border-t border-blue-300">Driver compensation (charged now via Stripe): ${breakdown.driverCompensation}</div>
                <div className="text-sm">Platform fee (15%, charged only on completion): ${breakdown.platformFee}</div>
                <div className="text-xs text-blue-800 mt-1">Projected total on completion: ${breakdown.totalPrice}. You can adjust the driver compensation above.</div>
              </div>
            </div>
          )}

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <div className="pt-4 flex gap-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-[#1E3A8A] hover:bg-blue-900 text-white py-3 rounded-xl font-medium disabled:opacity-70"
            >
              {loading ? 'Processing...' : 'Post Trip & Pay via Stripe'}
            </button>
            <Link href="/organization/trips" className="flex-1 text-center border border-gray-300 py-3 rounded-xl font-medium text-blue-950 hover:bg-gray-50">
              Cancel
            </Link>
          </div>
        </form>

        <p className="text-xs text-blue-700 mt-4 text-center">
          Driver compensation is charged now via Stripe. The 15% platform fee is charged only when you mark the trip as completed.
        </p>
      </div>
    </div>
  );
}
