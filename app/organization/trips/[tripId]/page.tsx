'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { getVisibleProfilePhotoPath } from '@/lib/profile-photo';
import { authFetch } from '@/lib/auth-fetch';
import TripMap from '../../../components/TripMap';
import DriverAvatar from '../../../components/DriverAvatar';
import VehiclePhotos from '../../../components/VehiclePhotos';

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
  platform_fee_status?: string;
  platform_fee?: number | null;
  distance_miles: number | null;
  passengers?: number | null;
  created_at: string;
  assigned_driver_id: string | null;
  organization_id: string;
  start_lat?: number | null;
  start_lng?: number | null;
  end_lat?: number | null;
  end_lng?: number | null;
}

interface Offer {
  id: string;
  driver_id: string;
  message: string | null;
  offered_price: number | null;
  status: string;
  created_at: string;
  driver_name: string;
  driver_photo_url?: string | null;
  vehicle_photos?: string[];
  driverRating?: number;
  reviewCount?: number;
}

export default function OrganizationTripDetail() {
  const params = useParams<{ tripId: string }>();
  const router = useRouter();
  const tripId = params.tripId;

  const [trip, setTrip] = useState<Trip | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [assignedDriverName, setAssignedDriverName] = useState<string | null>(null);
  const [assignedDriverPhoto, setAssignedDriverPhoto] = useState<string | null>(null);
  const [assignedVehiclePhotos, setAssignedVehiclePhotos] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [offersError, setOffersError] = useState<string | null>(null);

  const fetchTripDetails = useCallback(async () => {
    if (!tripId) return;

    setLoading(true);
    setError(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError('Please sign in to view this trip.');
        setLoading(false);
        return;
      }

      const { data: tripData, error: tripError } = await supabase
        .from('trips')
        .select('*')
        .eq('id', tripId)
        .single();

      if (tripError || !tripData) {
        setError(tripError?.message || 'Trip not found.');
        setLoading(false);
        return;
      }

      if (tripData.organization_id !== user.id) {
        setError('You do not have permission to view this trip.');
        setLoading(false);
        return;
      }

      setTrip(tripData as Trip);

      const { data: offersData, error: offersError } = await supabase
        .from('trip_offers')
        .select('*')
        .eq('trip_id', tripId)
        .order('created_at', { ascending: false });

      if (offersError) {
        console.error('Offers fetch error:', offersError);
        setOffersError(`Could not load offers: ${offersError.message}`);
        setOffers([]);
      } else {
        setOffersError(null);
      }

      const driverIds = (offersData || []).map((o) => o.driver_id);
      let driverReviewsMap: Record<string, { total: number; count: number }> = {};

      if (driverIds.length > 0) {
        const { data: reviewsData } = await supabase
          .from('driver_reviews')
          .select('driver_id, rating')
          .in('driver_id', driverIds);

        reviewsData?.forEach((r) => {
          if (!driverReviewsMap[r.driver_id]) {
            driverReviewsMap[r.driver_id] = { total: 0, count: 0 };
          }
          driverReviewsMap[r.driver_id].total += r.rating;
          driverReviewsMap[r.driver_id].count += 1;
        });
      }

      const offersWithNames = await Promise.all(
        (offersData || []).map(async (offer) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, profile_photo_url, profile_photo_status, vehicle_photos')
            .eq('id', offer.driver_id)
            .single();

          const rev = driverReviewsMap[offer.driver_id];
          const avg = rev ? Math.round((rev.total / rev.count) * 10) / 10 : 0;

          return {
            ...offer,
            driver_name: profile?.full_name || 'Unknown Driver',
            driver_photo_url: profile ? getVisibleProfilePhotoPath(profile) : null,
            vehicle_photos: profile?.vehicle_photos || [],
            driverRating: avg,
            reviewCount: rev?.count ?? 0,
          };
        })
      );

      setOffers(offersWithNames);

      if (tripData.assigned_driver_id) {
        const { data: driverProf } = await supabase
          .from('profiles')
          .select('full_name, profile_photo_url, profile_photo_status, vehicle_photos')
          .eq('id', tripData.assigned_driver_id)
          .single();

        if (driverProf) {
          setAssignedDriverName(driverProf.full_name);
          setAssignedDriverPhoto(getVisibleProfilePhotoPath(driverProf));
          setAssignedVehiclePhotos(driverProf.vehicle_photos || []);
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load trip');
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    fetchTripDetails();
  }, [fetchTripDetails]);

  const handleApprove = async (offerId: string) => {
    if (!trip || !confirm('Approve this offer? The driver will be assigned and all other pending offers will be rejected.')) return;
    setProcessingId(offerId);
    try {
      const response = await authFetch('/api/trip-offers/approve', {
        method: 'POST',
        body: JSON.stringify({ offerId }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to approve offer');
      }

      alert(data.message || 'Offer approved! Driver assigned to this trip.');
      await fetchTripDetails();
    } catch (err: unknown) {
      alert('Error: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (offerId: string) => {
    if (!confirm('Reject this offer?')) return;
    setProcessingId(offerId);
    try {
      await supabase.from('trip_offers').update({ status: 'rejected' }).eq('id', offerId);
      await fetchTripDetails();
    } catch (err: unknown) {
      alert('Error: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setProcessingId(null);
    }
  };

  const handlePayNow = async () => {
    if (!trip || trip.payment_status === 'paid') return;

    setPaying(true);
    try {
      const response = await authFetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        body: JSON.stringify({ tripId: trip.id, chargeType: 'driver_compensation' }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to start checkout');
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      throw new Error('No checkout URL returned');
    } catch (err: unknown) {
      alert('Error: ' + (err instanceof Error ? err.message : 'Payment failed'));
    } finally {
      setPaying(false);
    }
  };

  const handleCancel = async () => {
    if (!trip || !confirm('Cancel this trip?')) return;
    setProcessingId(trip.id);
    try {
      await supabase
        .from('trips')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', trip.id);
      await supabase
        .from('trip_offers')
        .update({ status: 'rejected' })
        .eq('trip_id', trip.id)
        .eq('status', 'pending');
      router.push('/organization/trips');
    } catch (err: unknown) {
      alert('Error: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setProcessingId(null);
    }
  };

  const handleComplete = async () => {
    if (!trip) return;
    if (
      !confirm(
        'Mark this trip as completed? Platform fee will be charged if unpaid and driver compensation will be transferred.'
      )
    )
      return;

    setProcessingId(trip.id);
    try {
      const platformFee = trip.platform_fee || 0;

      if (trip.platform_fee_status !== 'paid' && platformFee > 0) {
        const response = await authFetch('/api/stripe/create-checkout-session', {
          method: 'POST',
          body: JSON.stringify({ tripId: trip.id, chargeType: 'platform_fee' }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Platform fee checkout failed');
        if (data.url) {
          window.location.href = data.url;
          return;
        }
      }

      if (trip.payment_status === 'paid' && trip.assigned_driver_id) {
        const transferResponse = await authFetch('/api/stripe/connect/transfer-payout', {
          method: 'POST',
          body: JSON.stringify({ tripId: trip.id }),
        });
        const transferData = await transferResponse.json();
        if (!transferResponse.ok && !transferData.alreadyTransferred) {
          throw new Error(transferData.error || 'Driver payout failed');
        }
      }

      await supabase
        .from('trips')
        .update({ status: 'completed', platform_fee_status: 'paid', updated_at: new Date().toISOString() })
        .eq('id', trip.id);

      await fetchTripDetails();
      alert('Trip marked as completed.');
    } catch (err: unknown) {
      alert('Error: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-blue-800">Loading trip details...</div>
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center">
        <h2 className="text-xl font-semibold text-blue-950 mb-2">Unable to load trip</h2>
        <p className="text-blue-800 mb-6">{error || 'Trip not found.'}</p>
        <Link
          href="/organization/trips"
          className="inline-block px-5 py-2.5 bg-[#1E3A8A] text-white rounded-xl font-medium hover:bg-blue-900"
        >
          Back to My Trips
        </Link>
      </div>
    );
  }

  const statusClass =
    trip.status === 'open'
      ? 'bg-green-100 text-green-700'
      : trip.status === 'assigned'
        ? 'bg-blue-100 text-blue-900'
        : trip.status === 'completed'
          ? 'bg-purple-100 text-purple-700'
          : 'bg-gray-100 text-blue-900';

  const needsPayment = trip.payment_status !== 'paid';
  const paymentStatusLabel =
    trip.payment_status === 'paid'
      ? 'Paid'
      : trip.payment_status === 'failed'
        ? 'Payment failed'
        : 'Payment pending';
  const paymentStatusClass =
    trip.payment_status === 'paid'
      ? 'bg-green-100 text-green-800 border-green-200'
      : trip.payment_status === 'failed'
        ? 'bg-red-50 text-red-800 border-red-200'
        : 'bg-amber-50 text-amber-900 border-amber-200';

  return (
    <div>
      <div className="mb-6">
        <Link href="/organization/trips" className="text-sm text-blue-900 hover:underline">
          ← Back to My Trips
        </Link>
      </div>

      {needsPayment && (
        <div className={`mb-6 rounded-2xl border p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 ${paymentStatusClass}`}>
          <div>
            <p className="font-semibold text-base">
              {trip.payment_status === 'failed'
                ? 'Payment failed — complete payment to publish this trip'
                : 'Payment required — complete checkout to make this trip visible to drivers'}
            </p>
            <p className="text-sm mt-1 opacity-90">
              Driver compensation: ${trip.final_price || trip.price || 0} · Status: {paymentStatusLabel}
            </p>
          </div>
          <button
            onClick={handlePayNow}
            disabled={paying}
            className="px-6 py-3 bg-[#1E3A8A] hover:bg-blue-900 text-white rounded-xl font-semibold text-sm whitespace-nowrap disabled:opacity-60 transition shadow-sm"
          >
            {paying ? 'Redirecting to checkout…' : 'Pay Now'}
          </button>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-bold text-blue-950">{trip.title}</h1>
            <span className={`px-3 py-1 text-xs font-semibold rounded-full ${statusClass}`}>
              {trip.status}
            </span>
            <span
              className={`px-3 py-1 text-xs font-semibold rounded-full border ${
                trip.payment_status === 'paid'
                  ? 'bg-green-100 text-green-800 border-green-200'
                  : trip.payment_status === 'failed'
                    ? 'bg-red-100 text-red-700 border-red-200'
                    : 'bg-amber-100 text-amber-800 border-amber-200'
              }`}
            >
              {paymentStatusLabel}
            </span>
          </div>
          <p className="text-blue-800 mt-1">
            {trip.pickup_location} → {trip.dropoff_location}
          </p>
        </div>

        <div className="flex gap-2 flex-shrink-0">
          {needsPayment && (
            <button
              onClick={handlePayNow}
              disabled={paying}
              className="px-5 py-2 text-sm font-semibold bg-[#1E3A8A] hover:bg-blue-900 text-white rounded-xl disabled:opacity-60 transition"
            >
              {paying ? 'Redirecting…' : 'Pay Now'}
            </button>
          )}
          {trip.status === 'open' && (
            <button
              onClick={handleCancel}
              disabled={!!processingId}
              className="px-4 py-2 text-sm border border-red-200 text-red-600 rounded-xl hover:bg-red-50 disabled:opacity-60"
            >
              Cancel Trip
            </button>
          )}
          {trip.status === 'assigned' && (
            <button
              onClick={handleComplete}
              disabled={!!processingId}
              className="px-4 py-2 text-sm bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-60"
            >
              Mark Completed
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-blue-950">Route</h2>
          <TripMap
            pickup={trip.pickup_location}
            dropoff={trip.dropoff_location}
            pickupCoords={
              trip.start_lat != null && trip.start_lng != null
                ? { lat: Number(trip.start_lat), lng: Number(trip.start_lng) }
                : null
            }
            dropoffCoords={
              trip.end_lat != null && trip.end_lng != null
                ? { lat: Number(trip.end_lat), lng: Number(trip.end_lng) }
                : null
            }
            showPickupDropoffMarkers
            height={280}
          />

          {trip.description && (
            <div>
              <div className="text-sm font-medium text-blue-800">Description</div>
              <p className="text-blue-900 mt-1">{trip.description}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 text-sm text-blue-900">
            <div>
              <span className="text-blue-700">Pickup:</span> {trip.pickup_location}
            </div>
            <div>
              <span className="text-blue-700">Dropoff:</span> {trip.dropoff_location}
            </div>
            <div>
              <span className="text-blue-700">Time:</span>{' '}
              {new Date(trip.pickup_time).toLocaleString()}
            </div>
            <div>
              <span className="text-blue-700">Rate:</span> $
              {trip.final_price || trip.price}
            </div>
            <div>
              <span className="text-blue-700">Passengers:</span> {trip.passengers || 1}
            </div>
            {trip.distance_miles && (
              <div>
                <span className="text-blue-700">Distance:</span> {trip.distance_miles} mi
              </div>
            )}
            <div className="col-span-2">
              <span className="text-blue-700">Payment:</span>{' '}
              <span
                className={
                  trip.payment_status === 'paid'
                    ? 'text-green-700 font-medium'
                    : trip.payment_status === 'failed'
                      ? 'text-red-600 font-medium'
                      : 'text-amber-700 font-medium'
                }
              >
                {paymentStatusLabel}
              </span>
              {needsPayment && (
                <span className="text-blue-700">
                  {' '}
                  — ${trip.final_price || trip.price || 0} driver compensation due
                </span>
              )}
            </div>
          </div>

          {trip.assigned_driver_id && (
            <div className="pt-4 border-t">
              <div className="text-sm font-medium text-blue-800 mb-2">Assigned Driver</div>
              <div className="flex items-center gap-3">
                <DriverAvatar photoPath={assignedDriverPhoto} size={40} />
                <span className="text-blue-950 font-medium">
                  {assignedDriverName || 'Driver'}
                </span>
              </div>
              {assignedVehiclePhotos.length > 0 && (
                <VehiclePhotos photoPaths={assignedVehiclePhotos} maxDisplay={2} />
              )}
            </div>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-blue-950 mb-4">
            Driver Offers ({offers.length})
          </h2>

          {offersError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              {offersError}
            </div>
          )}

          {offers.length === 0 ? (
            <p className="text-sm text-blue-800 italic">
              No offers yet. Drivers will see this trip once payment is confirmed.
            </p>
          ) : (
            <div className="space-y-4">
              {offers.map((offer) => (
                <div
                  key={offer.id}
                  className="p-4 bg-gray-50 rounded-xl border flex flex-col gap-3"
                >
                  <div className="flex items-center gap-3">
                    <DriverAvatar photoPath={offer.driver_photo_url} size={32} />
                    <span className="font-medium text-blue-950">{offer.driver_name}</span>
                    {(offer.reviewCount ?? 0) > 0 && offer.driverRating !== undefined && (
                      <span className="text-xs text-yellow-600">
                        ★ {offer.driverRating} ({offer.reviewCount})
                      </span>
                    )}
                    <span
                      className={`ml-auto px-2.5 py-0.5 text-xs font-semibold rounded-full ${
                        offer.status === 'approved'
                          ? 'bg-green-100 text-green-700'
                          : offer.status === 'rejected'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-yellow-100 text-yellow-700'
                      }`}
                    >
                      {offer.status}
                    </span>
                  </div>

                  <VehiclePhotos photoPaths={offer.vehicle_photos || []} maxDisplay={1} />

                  {offer.offered_price != null && (
                    <p className="text-sm font-medium text-blue-950">
                      Offered rate: ${offer.offered_price}
                    </p>
                  )}

                  {offer.message && (
                    <p className="text-sm text-blue-900 italic">&ldquo;{offer.message}&rdquo;</p>
                  )}
                  <p className="text-xs text-blue-700">
                    Submitted {new Date(offer.created_at).toLocaleString()}
                  </p>

                  {trip.status === 'open' && offer.status === 'pending' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprove(offer.id)}
                        disabled={!!processingId}
                        className="px-4 py-2 text-sm font-medium bg-green-600 hover:bg-green-700 text-white rounded-xl disabled:opacity-60"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleReject(offer.id)}
                        disabled={!!processingId}
                        className="px-4 py-2 text-sm font-medium border border-red-300 text-red-600 hover:bg-red-50 rounded-xl disabled:opacity-60"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}