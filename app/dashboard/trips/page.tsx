'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { authFetch } from '@/lib/auth-fetch';
import { getErrorMessage } from '@/lib/errors';
import {
  canDriverSubmitOffers,
  tripFitsDriverCapacity,
  type DriverSeatingProfile,
} from '@/lib/seating-validation';
import TripMap from '../../components/TripMap';
import TripMapPreview from '@/components/TripMapPreview';
import OrganizationLogo from '../../components/OrganizationLogo';
import { truncateLocation } from '@/lib/rider/format';
import { toDateInputValue } from '@/lib/driver/document-dates';

interface Trip {
  id: string;
  title: string;
  description: string | null;
  pickup_location: string;
  dropoff_location: string;
  pickup_time: string;
  price: number | null;
  final_price: number | null;
  status: string;
  payment_status: string;
  organization_id: string | null;
  trip_source?: string | null;
  organization_name?: string;
  organization_photo_url?: string | null;
  passengers?: number | null;
}

interface ExistingOffer {
  trip_id: string;
  status: string;
}

export default function BrowseTrips() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [existingOffers, setExistingOffers] = useState<Record<string, ExistingOffer>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [offerMessage, setOfferMessage] = useState('');
  const [offeredPrice, setOfferedPrice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [driverSeating, setDriverSeating] = useState<DriverSeatingProfile | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');

  const getTripRate = (trip: Trip) => trip.final_price ?? trip.price;

  const hasActiveFilters =
    !!searchTerm.trim() || !!dateFilter || !!minPrice || !!maxPrice;

  const filteredTrips = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const min = minPrice !== '' ? Number(minPrice) : null;
    const max = maxPrice !== '' ? Number(maxPrice) : null;

    return trips.filter((trip) => {
      if (query) {
        const haystack = [
          trip.pickup_location,
          trip.dropoff_location,
          trip.title,
          trip.organization_name,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(query)) return false;
      }

      if (dateFilter) {
        const tripDate = toDateInputValue(trip.pickup_time);
        if (tripDate !== dateFilter) return false;
      }

      const rate = getTripRate(trip);
      if (min != null && !Number.isNaN(min)) {
        if (rate == null || rate < min) return false;
      }
      if (max != null && !Number.isNaN(max)) {
        if (rate == null || rate > max) return false;
      }

      return true;
    });
  }, [trips, searchTerm, dateFilter, minPrice, maxPrice]);

  const clearFilters = () => {
    setSearchTerm('');
    setDateFilter('');
    setMinPrice('');
    setMaxPrice('');
  };

  const fetchExistingOffers = useCallback(async (userId: string) => {
    const { data, error: offersError } = await supabase
      .from('trip_offers')
      .select('trip_id, status')
      .eq('driver_id', userId);

    if (offersError) {
      console.error('Existing offers fetch error:', offersError);
      return;
    }

    const map: Record<string, ExistingOffer> = {};
    (data || []).forEach((o) => {
      map[o.trip_id] = { trip_id: o.trip_id, status: o.status };
    });
    setExistingOffers(map);
  }, []);

  const fetchOpenTrips = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError('Please sign in to browse trips.');
        setTrips([]);
        setLoading(false);
        return;
      }

      await fetchExistingOffers(user.id);

      const { data: seatingProf } = await supabase
        .from('profiles')
        .select(
          'vehicle_year, vehicle_make, vehicle_model, passenger_capacity, seating_override_note, seating_approval_status'
        )
        .eq('id', user.id)
        .single();
      setDriverSeating(seatingProf as DriverSeatingProfile);

      const { data: tripsData, error: tripsError } = await supabase
        .from('trips')
        .select('*')
        .eq('status', 'open')
        .eq('payment_status', 'paid')
        .order('pickup_time', { ascending: true });

      if (tripsError) {
        console.error('Trips fetch error:', tripsError);
        setError(`Could not load trips: ${tripsError.message}`);
        setTrips([]);
        setLoading(false);
        return;
      }

      if (!tripsData || tripsData.length === 0) {
        setTrips([]);
        setLoading(false);
        return;
      }

      const orgIds = [...new Set(tripsData.map((t) => t.organization_id).filter(Boolean))] as string[];
      let profileMap: Record<string, { organization_name?: string; full_name?: string; profile_photo_url?: string | null }> = {};

      if (orgIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, organization_name, full_name, profile_photo_url')
          .in('id', orgIds);

        if (profilesError) {
          console.error('Profiles fetch error:', profilesError);
        }

        profileMap = Object.fromEntries((profilesData || []).map((p) => [p.id, p]));
      }

      const formatted: Trip[] = tripsData.map((trip) => {
        const isRiderTrip = trip.trip_source === 'rider' || !trip.organization_id;
        const profile = trip.organization_id ? profileMap[trip.organization_id] : null;
        return {
          ...trip,
          organization_name: isRiderTrip
            ? 'Personal Ride'
            : profile?.organization_name || profile?.full_name || 'Organization',
          organization_photo_url: isRiderTrip ? null : profile?.profile_photo_url || null,
        };
      });

      setTrips(formatted);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
      setTrips([]);
    } finally {
      setLoading(false);
    }
  }, [fetchExistingOffers]);

  useEffect(() => {
    fetchOpenTrips();
  }, [fetchOpenTrips]);

  const openDetails = (trip: Trip) => {
    setSelectedTrip(trip);
    setOfferMessage('');
    setSubmitError(null);
    const rate = trip.final_price ?? trip.price;
    setOfferedPrice(rate != null ? String(rate) : '');
  };

  const closeDetails = () => {
    setSelectedTrip(null);
    setOfferMessage('');
    setOfferedPrice('');
    setSubmitError(null);
  };

  const offerEligibility = driverSeating ? canDriverSubmitOffers(driverSeating) : null;
  const canSubmitOffers = offerEligibility?.ok ?? false;

  const tripCapacityOk = (trip: Trip) =>
    driverSeating
      ? tripFitsDriverCapacity(trip.passengers, driverSeating.passenger_capacity).ok
      : false;

  const submitOffer = async () => {
    if (!selectedTrip) return;

    if (driverSeating) {
      const globalCheck = canDriverSubmitOffers(driverSeating);
      if (!globalCheck.ok) {
        setSubmitError(globalCheck.error!);
        return;
      }
      const capCheck = tripFitsDriverCapacity(
        selectedTrip.passengers,
        driverSeating.passenger_capacity
      );
      if (!capCheck.ok) {
        setSubmitError(capCheck.error!);
        return;
      }
    }

    const existing = existingOffers[selectedTrip.id];
    if (existing) {
      setSubmitError(
        `You already submitted an offer on this trip (status: ${existing.status}). View it in My Offers.`
      );
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Not logged in');

      const response = await authFetch('/api/trip-offers', {
        method: 'POST',
        body: JSON.stringify({
          tripId: selectedTrip.id,
          message: offerMessage,
          offeredPrice: offeredPrice ? Number(offeredPrice) : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Request failed (${response.status})`);
      }

      setExistingOffers((prev) => ({
        ...prev,
        [selectedTrip.id]: {
          trip_id: selectedTrip.id,
          status: data.offer?.status ?? 'pending',
        },
      }));

      if (data.autoMatchStarted) {
        alert('Offer submitted! The rider has 60 seconds to confirm your assignment.');
      } else {
        alert(
          data.offer?.status === 'pending_confirmation'
            ? 'Offer submitted! Waiting for rider confirmation.'
            : 'Offer submitted! The organization or rider can now review your offer.'
        );
      }
      closeDetails();
      await fetchOpenTrips();
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      setSubmitError(message);
      alert('Failed to submit offer: ' + message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-blue-950 font-medium">Loading available trips...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-blue-950">Browse Available Trips</h1>
          <p className="text-blue-900 mt-1">
            View open, paid trips from organizations and submit your offers to drive.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/dashboard/my-offers"
            className="px-4 py-2 text-sm font-semibold border-2 border-[#1E3A8A] text-[#1E3A8A] rounded-xl hover:bg-blue-50 transition"
          >
            My Offers
          </Link>
          <button
            onClick={fetchOpenTrips}
            className="px-4 py-2 text-sm font-semibold border-2 border-blue-300 text-blue-950 rounded-xl hover:bg-blue-50 transition"
          >
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          {error}
        </div>
      )}

      {offerEligibility && !offerEligibility.ok && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-sm">
          <p className="font-semibold mb-1">Offers unavailable</p>
          <p>{offerEligibility.error}</p>
          <Link href="/dashboard/profile" className="inline-block mt-2 text-[#1E3A8A] font-medium hover:underline">
            Go to Profile →
          </Link>
        </div>
      )}

      {canSubmitOffers && driverSeating?.passenger_capacity != null && (
        <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-900">
          Your approved capacity: <strong>{driverSeating.passenger_capacity}</strong> passenger
          {driverSeating.passenger_capacity !== 1 ? 's' : ''}. Trips requiring more seats are
          marked below.
        </div>
      )}

      {trips.length > 0 && (
        <div className="mb-6 bg-white border border-blue-200 rounded-2xl p-5 shadow-sm">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-blue-900 mb-1">
                Search locations
              </label>
              <input
                type="text"
                placeholder="Pickup, dropoff, title, or organization..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full border-2 border-blue-200 rounded-xl px-4 py-2.5 text-blue-950 placeholder:text-blue-800/50 focus:border-[#1E3A8A] focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-blue-900 mb-1">Pickup date</label>
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="border-2 border-blue-200 rounded-xl px-4 py-2.5 text-blue-950 focus:border-[#1E3A8A] focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>

            <div className="flex gap-3">
              <div>
                <label className="block text-sm font-medium text-blue-900 mb-1">Min price</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="$0"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  className="w-28 border-2 border-blue-200 rounded-xl px-4 py-2.5 text-blue-950 focus:border-[#1E3A8A] focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-blue-900 mb-1">Max price</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="$200"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  className="w-28 border-2 border-blue-200 rounded-xl px-4 py-2.5 text-blue-950 focus:border-[#1E3A8A] focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-sm text-blue-800 hover:text-[#1E3A8A] underline font-medium pb-2.5"
              >
                Clear filters
              </button>
            )}
          </div>

          {hasActiveFilters && (
            <p className="mt-3 text-sm text-blue-800">
              Showing <strong>{filteredTrips.length}</strong> of <strong>{trips.length}</strong>{' '}
              trip{trips.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      )}

      {trips.length === 0 ? (
        <div className="bg-white border border-blue-200 rounded-2xl p-12 text-center shadow-sm">
          <h3 className="text-xl font-semibold text-blue-950 mb-2">No open trips available</h3>
          <p className="text-blue-900">
            {error
              ? 'Fix the error above and refresh.'
              : 'Organizations post trips after payment clears. Check back soon or tap Refresh.'}
          </p>
        </div>
      ) : filteredTrips.length === 0 ? (
        <div className="bg-white border border-blue-200 rounded-2xl p-12 text-center shadow-sm">
          <h3 className="text-xl font-semibold text-blue-950 mb-2">No trips match your filters</h3>
          <p className="text-blue-900 mb-4">
            Try adjusting your search, date, or price range.
          </p>
          <button
            type="button"
            onClick={clearFilters}
            className="px-5 py-2.5 bg-[#1E3A8A] hover:bg-blue-900 text-white rounded-xl text-sm font-semibold transition"
          >
            Clear all filters
          </button>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {filteredTrips.map((trip) => {
            const existing = existingOffers[trip.id];
            const fitsCapacity = tripCapacityOk(trip);
            const tooManyPassengers = canSubmitOffers && !fitsCapacity;
            const rate = getTripRate(trip);

            return (
              <div
                key={trip.id}
                className="bg-white border border-blue-200 rounded-2xl overflow-hidden flex flex-col shadow-sm hover:shadow-md hover:border-blue-300 transition"
              >
                <div className="relative bg-gray-100">
                  <TripMapPreview
                    pickup={trip.pickup_location}
                    dropoff={trip.dropoff_location}
                  />
                  <span className="absolute top-3 left-3 bg-white/95 px-3 py-1 rounded-full text-xs font-semibold text-blue-950 shadow-sm">
                    {trip.organization_name}
                  </span>
                  <span className="absolute top-3 right-3 px-3 py-1 text-xs font-bold bg-green-100 text-green-800 border border-green-200 rounded-full">
                    Open
                  </span>
                </div>

                <div className="p-6 flex flex-col flex-1">
                  <div className="flex justify-between items-start gap-3 mb-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <OrganizationLogo photoPath={trip.organization_photo_url} size={36} />
                      <div className="min-w-0">
                        <h3 className="text-lg font-semibold text-blue-950 leading-tight">
                          {trip.title}
                        </h3>
                        <div className="text-sm text-blue-900 mt-1">
                          <span className="font-medium text-green-700">
                            {truncateLocation(trip.pickup_location, 36)}
                          </span>
                          <span className="mx-1 text-[#1E3A8A]">→</span>
                          <span className="font-medium text-red-600">
                            {truncateLocation(trip.dropoff_location, 36)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-2xl font-bold text-[#1E3A8A]">
                        ${rate ?? '—'}
                      </div>
                      <div className="text-xs text-gray-500">posted rate</div>
                    </div>
                  </div>

                  {trip.description && (
                    <p className="text-sm text-blue-900 mb-4 line-clamp-2">{trip.description}</p>
                  )}

                  {existing && (
                    <div className="mb-3 text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      Offer submitted — {existing.status}
                    </div>
                  )}
                  {tooManyPassengers && (
                    <div className="mb-3 text-xs font-medium text-red-800 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                      Needs {(trip.passengers ?? 1)} seats — exceeds your capacity (
                      {driverSeating?.passenger_capacity})
                    </div>
                  )}

                  <div className="mt-auto pt-4 border-t border-blue-100 flex items-center justify-between gap-3 text-sm">
                    <div className="text-blue-950 font-medium">
                      {new Date(trip.pickup_time).toLocaleString()}
                    </div>
                    <button
                      onClick={() => openDetails(trip)}
                      className="shrink-0 px-5 py-2.5 bg-[#1E3A8A] hover:bg-blue-900 active:bg-blue-950 text-white rounded-xl text-sm font-semibold shadow-sm transition"
                    >
                      {existing ? 'View Trip' : 'View Details & Offer'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedTrip && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-auto">
            <div className="p-6 border-b border-blue-100 bg-blue-50/50">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <OrganizationLogo photoPath={selectedTrip.organization_photo_url} size={48} />
                  <div>
                    <h3 className="text-2xl font-bold text-blue-950">{selectedTrip.title}</h3>
                    <p className="text-blue-900 font-medium mt-1">{selectedTrip.organization_name}</p>
                  </div>
                </div>
                <button
                  onClick={closeDetails}
                  className="text-2xl leading-none text-blue-800 hover:text-blue-950"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <div className="text-sm font-semibold text-blue-950 mb-2">Route</div>
                <TripMap
                  pickup={selectedTrip.pickup_location}
                  dropoff={selectedTrip.dropoff_location}
                />
              </div>

              {selectedTrip.description && (
                <div>
                  <div className="text-sm font-semibold text-blue-950">Description</div>
                  <p className="text-blue-950 mt-1">{selectedTrip.description}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm text-blue-950">
                <div>
                  <span className="font-semibold text-blue-900">Pickup:</span> {selectedTrip.pickup_location}
                </div>
                <div>
                  <span className="font-semibold text-blue-900">Dropoff:</span> {selectedTrip.dropoff_location}
                </div>
                <div>
                  <span className="font-semibold text-blue-900">Pickup Time:</span>{' '}
                  {new Date(selectedTrip.pickup_time).toLocaleString()}
                </div>
                <div>
                  <span className="font-semibold text-blue-900">Posted Rate:</span> $
                  {selectedTrip.final_price || selectedTrip.price}
                </div>
                <div>
                  <span className="font-semibold text-blue-900">Passengers:</span>{' '}
                  {selectedTrip.passengers || 1}
                  {driverSeating?.passenger_capacity != null && (
                    <span
                      className={
                        tripCapacityOk(selectedTrip) ? ' text-green-700' : ' text-red-600 font-medium'
                      }
                    >
                      {' '}
                      ({tripCapacityOk(selectedTrip) ? 'fits' : 'exceeds'} your{' '}
                      {driverSeating.passenger_capacity}-seat capacity)
                    </span>
                  )}
                </div>
              </div>

              {existingOffers[selectedTrip.id] ? (
                <div className="pt-4 border-t bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <p className="text-sm text-amber-900 font-medium">
                    You already submitted an offer on this trip (
                    {existingOffers[selectedTrip.id].status}).
                  </p>
                  <Link
                    href="/dashboard/my-offers"
                    className="inline-block mt-2 text-sm text-[#1E3A8A] font-medium hover:underline"
                  >
                    View in My Offers →
                  </Link>
                </div>
              ) : (
                <>
                  <div className="pt-4 border-t">
                    <label className="block text-sm font-semibold text-blue-950 mb-1">
                      Your Offered Rate ($)
                    </label>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={offeredPrice}
                      onChange={(e) => setOfferedPrice(e.target.value)}
                      className="w-full border-2 border-blue-200 bg-white rounded-xl px-4 py-2.5 text-blue-950 placeholder:text-blue-800/60 focus:border-[#1E3A8A] focus:outline-none focus:ring-2 focus:ring-blue-200"
                      placeholder="Enter your rate"
                    />
                    <p className="text-xs text-blue-900 mt-1">
                      Defaults to the posted rate. You may adjust if needed.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-blue-950 mb-1">
                      Message to Organization (optional)
                    </label>
                    <textarea
                      value={offerMessage}
                      onChange={(e) => setOfferMessage(e.target.value)}
                      className="w-full border-2 border-blue-200 bg-white rounded-xl px-4 py-3 text-blue-950 placeholder:text-blue-800/60 focus:border-[#1E3A8A] focus:outline-none focus:ring-2 focus:ring-blue-200"
                      rows={3}
                      placeholder="I have a clean minivan and 5 years experience with student transport..."
                    />
                  </div>

                  {submitError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                      {submitError}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="p-6 border-t border-blue-100 flex gap-3 justify-end bg-blue-50/80 rounded-b-2xl">
              <button
                onClick={closeDetails}
                className="px-6 py-2.5 border-2 border-blue-300 rounded-xl text-sm font-semibold text-blue-950 hover:bg-white transition"
              >
                Close
              </button>
              {!existingOffers[selectedTrip.id] && (
                <button
                  onClick={submitOffer}
                  disabled={
                    submitting ||
                    !offeredPrice ||
                    !canSubmitOffers ||
                    !tripCapacityOk(selectedTrip)
                  }
                  className="px-6 py-2.5 bg-[#1E3A8A] hover:bg-blue-900 active:bg-blue-950 text-white rounded-xl text-sm font-semibold shadow-sm disabled:bg-blue-300 disabled:text-blue-50 disabled:cursor-not-allowed transition"
                >
                  {submitting ? 'Submitting Offer...' : 'Submit Offer'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}