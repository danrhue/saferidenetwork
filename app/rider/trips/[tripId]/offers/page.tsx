'use client';

/**
 * Manual offer review — rider compares pending driver offers and accepts one.
 */

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { getVisibleProfilePhotoPath } from '@/lib/profile-photo';
import { resolveProfilePhotoUrl } from '@/lib/storage/profile-photos';
import { authFetch } from '@/lib/auth-fetch';
import DriverRatingSummary from '@/components/rider/DriverRatingSummary';
import RiderLoadingSpinner from '@/components/rider/RiderLoadingSpinner';
import RiderBackLink from '@/components/rider/RiderBackLink';
import { formatOfferEta } from '@/lib/rider/offers';
import { formatDateTime } from '@/lib/rider/format';
import { riderCardClass, riderPrimaryButtonClass } from '@/lib/rider/ui';

type TripRow = {
  id: string;
  title: string;
  status: string;
  payment_status: string | null;
  matching_mode: string | null;
  trip_source: string | null;
  rider_id: string | null;
  pickup_time: string;
  pickup_location: string;
  dropoff_location: string;
  distance_miles: number | null;
  final_price: number | null;
  total_price: number | null;
};

type OfferRow = {
  id: string;
  driver_id: string;
  message: string | null;
  offered_price: number | null;
  status: string;
  created_at: string;
};

type DriverProfile = {
  id: string;
  full_name: string | null;
  profile_photo_url: string | null;
  profile_photo_status?: string | null;
  avatar_url?: string | null;
  vehicle_year: number | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  passenger_capacity: number | null;
};

type OfferCard = OfferRow & {
  driver: DriverProfile;
  photoUrl: string | null;
};

async function resolveDriverPhoto(path: string | null): Promise<string | null> {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return resolveProfilePhotoUrl(supabase, path);
}

function OffersReviewContent() {
  const params = useParams();
  const router = useRouter();
  const tripId = typeof params.tripId === 'string' ? params.tripId.trim() : '';

  const [trip, setTrip] = useState<TripRow | null>(null);
  const [offers, setOffers] = useState<OfferCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState('');

  const loadOffers = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('Please sign in to review offers.');
    }

    const { data: tripRow, error: tripError } = await supabase
      .from('trips')
      .select(
        'id, title, status, payment_status, matching_mode, trip_source, rider_id, pickup_time, pickup_location, dropoff_location, distance_miles, final_price, total_price'
      )
      .eq('id', tripId)
      .eq('rider_id', user.id)
      .single();

    if (tripError || !tripRow) {
      throw new Error('Trip not found or you do not have access.');
    }

    const row = tripRow as TripRow;

    if (row.matching_mode !== 'manual_review') {
      router.replace(`/rider/trips/${tripId}`);
      return;
    }

    if (row.status === 'assigned') {
      router.replace(`/rider/trips/${tripId}?assigned=true`);
      return;
    }

    if (row.status !== 'open' || row.payment_status !== 'paid') {
      router.replace(`/rider/trips/${tripId}`);
      return;
    }

    setTrip(row);

    const { data: offerRows, error: offersError } = await supabase
      .from('trip_offers')
      .select('id, driver_id, message, offered_price, status, created_at')
      .eq('trip_id', tripId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (offersError) {
      throw new Error(offersError.message);
    }

    const pending = (offerRows ?? []) as OfferRow[];
    const driverIds = [...new Set(pending.map((o) => o.driver_id))];

    let profileMap: Record<string, DriverProfile> = {};
    if (driverIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select(
          'id, full_name, profile_photo_url, profile_photo_status, avatar_url, vehicle_year, vehicle_make, vehicle_model, passenger_capacity'
        )
        .in('id', driverIds);

      for (const p of profiles ?? []) {
        profileMap[p.id] = p as DriverProfile;
      }
    }

    const cards: OfferCard[] = await Promise.all(
      pending.map(async (offer) => {
        const driver = profileMap[offer.driver_id] ?? {
          id: offer.driver_id,
          full_name: null,
          profile_photo_url: null,
          vehicle_year: null,
          vehicle_make: null,
          vehicle_model: null,
          passenger_capacity: null,
        };
        const visiblePath = getVisibleProfilePhotoPath(driver);
        const photoSource = driver.avatar_url ?? visiblePath;
        const photoUrl = await resolveDriverPhoto(photoSource);
        return { ...offer, driver, photoUrl };
      })
    );

    setOffers(cards);
  }, [tripId, router]);

  useEffect(() => {
    loadOffers()
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load offers');
      })
      .finally(() => setLoading(false));
  }, [loadOffers]);

  useEffect(() => {
    if (!trip || trip.status !== 'open') return;
    const interval = setInterval(() => {
      loadOffers().catch(() => undefined);
    }, 12_000);
    return () => clearInterval(interval);
  }, [trip, loadOffers]);

  const handleAccept = async (offerId: string) => {
    if (!trip) return;

    const confirmed = window.confirm(
      'Accept this driver for your trip? All other pending offers will be declined.'
    );
    if (!confirmed) return;

    setAcceptingId(offerId);
    setActionMessage('');
    setError('');

    try {
      const res = await authFetch('/api/rider/offers/accept', {
        method: 'POST',
        body: JSON.stringify({ tripId: trip.id, offerId }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to accept driver');
      }

      router.replace(`/rider/trips/${trip.id}?assigned=true`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to accept driver');
    } finally {
      setAcceptingId(null);
    }
  };

  if (loading) {
    return <RiderLoadingSpinner message="Loading driver offers..." />;
  }

  if (error && !trip) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <p className="text-red-700">{error}</p>
        <Link
          href={`/rider/trips/${tripId}`}
          className="mt-4 inline-block text-sm font-semibold text-[#1E3A8A] hover:underline"
        >
          ← Back to trip
        </Link>
      </div>
    );
  }

  if (!trip) return null;

  const listedPrice = trip.total_price ?? trip.final_price;

  return (
    <div className="mx-auto max-w-2xl pb-10">
      <RiderBackLink href={`/rider/trips/${tripId}`} label="Back to trip" />

      <h1 className="text-2xl font-bold text-blue-950 sm:text-3xl">Review driver offers</h1>
      <p className="mt-2 text-sm text-blue-800">
        Compare vetted drivers and choose who you want for your ride. Pickup{' '}
        <strong>{formatDateTime(trip.pickup_time)}</strong>
      </p>

      <div className={`mt-4 ${riderCardClass}`}>
        <p className="text-sm font-medium text-blue-950">{trip.title}</p>
        <p className="mt-1 text-sm text-blue-800">
          {trip.pickup_location} → {trip.dropoff_location}
        </p>
        {listedPrice != null && (
          <p className="mt-2 text-sm text-blue-700">
            Trip total: <strong>${Number(listedPrice).toFixed(2)}</strong>
          </p>
        )}
      </div>

      {actionMessage && (
        <p className="mt-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
          {actionMessage}
        </p>
      )}

      {error && (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}

      {offers.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-blue-200 bg-blue-50/60 px-6 py-10 text-center">
          <p className="font-semibold text-blue-950">No offers yet</p>
          <p className="mt-2 text-sm text-blue-800">
            Drivers in your area can see this trip now. You will be notified when offers arrive.
          </p>
          <Link
            href={`/rider/trips/${tripId}`}
            className="mt-5 inline-flex text-sm font-semibold text-[#1E3A8A] hover:underline"
          >
            Return to trip details
          </Link>
        </div>
      ) : (
        <ul className="mt-6 space-y-4">
          {offers.map((offer) => {
            const vehicle = [
              offer.driver.vehicle_year,
              offer.driver.vehicle_make,
              offer.driver.vehicle_model,
            ]
              .filter(Boolean)
              .join(' ');

            const eta = formatOfferEta({
              pickupTime: trip.pickup_time,
              offerCreatedAt: offer.created_at,
              distanceMiles: trip.distance_miles,
            });

            return (
              <li key={offer.id} className={riderCardClass}>
                <div className="flex items-start gap-4">
                  {offer.photoUrl ? (
                    <img
                      src={offer.photoUrl}
                      alt={offer.driver.full_name ?? 'Driver'}
                      className="h-16 w-16 shrink-0 rounded-full border border-blue-100 object-cover"
                    />
                  ) : (
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-blue-100 text-2xl">
                      👤
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-lg font-semibold text-blue-950">
                      {offer.driver.full_name ?? 'Vetted Driver'}
                    </p>
                    <DriverRatingSummary
                      driverId={offer.driver.id}
                      driverName={offer.driver.full_name}
                      size="sm"
                      className="mt-1"
                    />
                    {vehicle && (
                      <p className="mt-1 text-sm text-blue-800">
                        {vehicle}
                        {offer.driver.passenger_capacity
                          ? ` · ${offer.driver.passenger_capacity} seats`
                          : ''}
                      </p>
                    )}
                  </div>
                </div>

                <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                  {offer.offered_price != null && (
                    <div className="rounded-xl bg-blue-50 px-3 py-2">
                      <dt className="text-xs font-medium uppercase tracking-wide text-blue-700">
                        Offer price
                      </dt>
                      <dd className="font-semibold text-blue-950">
                        ${Number(offer.offered_price).toFixed(2)}
                      </dd>
                    </div>
                  )}
                  <div className="rounded-xl bg-blue-50 px-3 py-2 sm:col-span-1">
                    <dt className="text-xs font-medium uppercase tracking-wide text-blue-700">
                      ETA / timing
                    </dt>
                    <dd className="text-blue-900">{eta}</dd>
                  </div>
                </dl>

                {offer.message && (
                  <blockquote className="mt-4 rounded-xl border border-blue-100 bg-blue-50/50 px-4 py-3 text-sm italic text-blue-900">
                    &ldquo;{offer.message}&rdquo;
                  </blockquote>
                )}

                <button
                  type="button"
                  onClick={() => handleAccept(offer.id)}
                  disabled={acceptingId !== null}
                  className={`mt-5 w-full sm:w-auto ${riderPrimaryButtonClass} disabled:cursor-not-allowed disabled:opacity-70`}
                >
                  {acceptingId === offer.id ? 'Assigning driver…' : 'Accept this driver'}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function RiderTripOffersPage() {
  return (
    <Suspense fallback={<RiderLoadingSpinner message="Loading offers..." />}>
      <OffersReviewContent />
    </Suspense>
  );
}