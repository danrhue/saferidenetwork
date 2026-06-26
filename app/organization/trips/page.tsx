'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getVisibleProfilePhotoPath } from '@/lib/profile-photo';
import { authFetch } from '@/lib/auth-fetch';
import TripMap from '../../components/TripMap';
import DriverAvatar from '../../components/DriverAvatar';
import VehiclePhotos from '../../components/VehiclePhotos';

interface Trip {
  id: string;
  title: string;
  description: string | null;
  pickup_location: string;
  dropoff_location: string;
  pickup_time: string;
  price: number | null;
  status: string;
  payment_status: string;
  distance_miles: number | null;
  calculated_price: number | null;
  final_price: number | null;
  created_at: string;
  assigned_driver_id: string | null;
  passengers?: number | null;
  platform_fee_status?: string;
  platform_fee?: number | null;
  assigned_driver_name?: string;
  assigned_driver_photo?: string | null;
  assigned_vehicle_photos?: string[];
}

interface Offer {
  id: string;
  driver_id: string;
  message: string | null;
  offered_price?: number | null;
  status: string;
  created_at: string;
  driver_name: string;
  driver_photo_url?: string | null;
  vehicle_photos?: string[];
  driverRating?: number; // avg rating
  reviewCount?: number;
}

interface DriverReview {
  id: string;
  rating: number;
  review: string | null;
  created_at: string;
  organization_name?: string;
}

export default function MyTrips() {
  const searchParams = useSearchParams();
  const [trips, setTrips] = useState<(Trip & { offers: Offer[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'open' | 'assigned' | 'completed'>('all');
  const [selectedTrip, setSelectedTrip] = useState<any>(null);
  const [currentReview, setCurrentReview] = useState<any>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  const fetchTrips = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: tripsData, error } = await supabase
      .from('trips')
      .select('*')
      .eq('organization_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }

    const tripsWithOffers = await Promise.all(
      (tripsData || []).map(async (trip) => {
        const { data: offersData } = await supabase
          .from('trip_offers')
          .select('*')
          .eq('trip_id', trip.id)
          .order('created_at', { ascending: false });

        // Collect driver ids
        const driverIds = (offersData || []).map(o => o.driver_id);

        // Fetch reviews for these drivers to compute averages
        let driverReviewsMap: Record<string, { total: number; count: number }> = {};
        if (driverIds.length > 0) {
          const { data: reviewsData } = await supabase
            .from('driver_reviews')
            .select('driver_id, rating')
            .in('driver_id', driverIds);

          if (reviewsData) {
            reviewsData.forEach((r: any) => {
              if (!driverReviewsMap[r.driver_id]) {
                driverReviewsMap[r.driver_id] = { total: 0, count: 0 };
              }
              driverReviewsMap[r.driver_id].total += r.rating;
              driverReviewsMap[r.driver_id].count += 1;
            });
          }
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
            const count = rev ? rev.count : 0;

            return {
              ...offer,
              driver_name: profile?.full_name || 'Unknown Driver',
              driver_photo_url: profile ? getVisibleProfilePhotoPath(profile) : null,
              vehicle_photos: profile?.vehicle_photos || [],
              driverRating: avg,
              reviewCount: count,
            };
          })
        );

        return { ...trip, offers: offersWithNames };
      })
    );

    setTrips(tripsWithOffers);
    setLoading(false);
  };

  useEffect(() => {
    fetchTrips();

    // Handle Stripe Checkout return (webhook is authoritative; this is a client-side fallback)
    const success = searchParams.get('success');
    const tripId = searchParams.get('tripId');
    const chargeType = searchParams.get('chargeType');
    if (success === 'true' && tripId) {
      const updates: Record<string, string> = { updated_at: new Date().toISOString() };
      if (chargeType === 'platform_fee') {
        updates.platform_fee_status = 'paid';
      } else {
        updates.payment_status = 'paid';
        updates.driver_payout_status = 'pending';
      }
      supabase
        .from('trips')
        .update(updates)
        .eq('id', tripId)
        .then(() => {
          window.history.replaceState({}, '', window.location.pathname);
          fetchTrips();
        });
    }
  }, [searchParams]);

  const filteredTrips = trips.filter(trip => {
    if (filter === 'all') return true;
    return trip.status === filter;
  });

  const handleApprove = async (tripId: string, offerId: string) => {
    if (!confirm('Approve this offer? The driver will be assigned and all other pending offers will be rejected.')) return;

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
      await fetchTrips();
    } catch (err: unknown) {
      alert('Error approving offer: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (offerId: string) => {
    if (!confirm('Reject this offer?')) return;
    setProcessingId(offerId);
    try {
      await supabase.from('trip_offers').update({ status: 'rejected' }).eq('id', offerId);
      await fetchTrips();
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handlePayNow = async (tripId: string) => {
    setProcessingId(tripId);
    try {
      const response = await authFetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        body: JSON.stringify({ tripId, chargeType: 'driver_compensation' }),
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
      setProcessingId(null);
    }
  };

  const handleCancel = async (tripId: string) => {
    if (!confirm('Cancel this trip?')) return;
    setProcessingId(tripId);
    try {
      await supabase.from('trips').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', tripId);
      await supabase.from('trip_offers').update({ status: 'rejected' }).eq('trip_id', tripId).eq('status', 'pending');
      alert('Trip cancelled.');
      await fetchTrips();
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleComplete = async (tripId: string, platformFee: number) => {
    if (
      !confirm(
        'Mark this trip as completed? This will charge the platform fee (if unpaid) and transfer driver compensation to the assigned driver via Stripe Connect.'
      )
    )
      return;
    setProcessingId(tripId);

    try {
      const trip = trips.find((t) => t.id === tripId);
      if (!trip) return;

      // Step 1: Charge platform fee if not yet paid
      if (trip.platform_fee_status !== 'paid' && platformFee > 0) {
        const response = await authFetch('/api/stripe/create-checkout-session', {
          method: 'POST',
          body: JSON.stringify({ tripId, chargeType: 'platform_fee' }),
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Platform fee checkout failed');

        if (data.url) {
          window.location.href = data.url;
          return;
        }
      }

      // Step 2: Transfer held driver compensation to connected Express account
      if (trip.payment_status === 'paid' && trip.assigned_driver_id) {
        const transferResponse = await authFetch('/api/stripe/connect/transfer-payout', {
          method: 'POST',
          body: JSON.stringify({ tripId }),
        });

        const transferData = await transferResponse.json();
        if (!transferResponse.ok && !transferData.alreadyTransferred) {
          throw new Error(transferData.error || 'Driver payout transfer failed');
        }
      }

      // Step 3: Mark trip complete
      await supabase
        .from('trips')
        .update({
          status: 'completed',
          platform_fee_status: trip.platform_fee_status === 'paid' ? 'paid' : 'paid',
          updated_at: new Date().toISOString(),
        })
        .eq('id', tripId);

      alert('Trip marked as completed. Driver payout has been initiated via Stripe Connect.');
      await fetchTrips();
    } catch (err: any) {
      alert('Error completing trip: ' + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const openDetails = async (trip: any) => {
    let enhancedTrip = { ...trip };
    if (trip.assigned_driver_id) {
      const { data: driverProf } = await supabase
        .from('profiles')
        .select('full_name, profile_photo_url, profile_photo_status, vehicle_photos')
        .eq('id', trip.assigned_driver_id)
        .single();
      if (driverProf) {
        enhancedTrip.assigned_driver_name = driverProf.full_name;
        enhancedTrip.assigned_driver_photo = getVisibleProfilePhotoPath(driverProf);
        enhancedTrip.assigned_vehicle_photos = driverProf.vehicle_photos || [];
      }
    }
    setSelectedTrip(enhancedTrip);
    if (trip.status === 'completed' && trip.assigned_driver_id) {
      fetchReviewForTrip(trip.id);
    } else {
      setCurrentReview(null);
      setReviewRating(5);
      setReviewText('');
    }
  };
  const closeDetails = () => setSelectedTrip(null);

  const fetchReviewForTrip = async (tripId: string) => {
    const { data } = await supabase
      .from('driver_reviews')
      .select('*')
      .eq('trip_id', tripId)
      .single();
    setCurrentReview(data);
    if (data) {
      setReviewRating(data.rating);
      setReviewText(data.review || '');
    }
  };

  const submitReview = async () => {
    if (!selectedTrip || !selectedTrip.assigned_driver_id) return;

    setSubmittingReview(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase.from('driver_reviews').insert({
        trip_id: selectedTrip.id,
        organization_id: user.id,
        driver_id: selectedTrip.assigned_driver_id,
        rating: reviewRating,
        review: reviewText.trim() || null,
      });

      if (error) throw error;

      alert('Review submitted successfully!');
      setCurrentReview({ rating: reviewRating, review: reviewText, created_at: new Date().toISOString() });
      await fetchTrips();
    } catch (err: any) {
      alert('Error submitting review: ' + err.message);
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading) return <div className="p-8">Loading trips...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-blue-950">My Trips</h1>
          <p className="text-blue-800">Review offers and manage your posted trips</p>
        </div>
        <Link href="/organization/trips/new" className="px-5 py-2.5 bg-[#1E3A8A] hover:bg-blue-900 text-white rounded-xl text-sm font-medium">
          + Post New Trip
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        {(['all', 'open', 'assigned', 'completed'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${filter === f ? 'bg-[#1E3A8A] text-white' : 'bg-white border text-blue-900 hover:bg-gray-50'}`}
          >
            {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {filteredTrips.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
          <h3 className="text-xl font-semibold mb-2">No trips found</h3>
          <p className="text-blue-800">Post your first trip to start receiving offers.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredTrips.map((trip) => (
            <div key={trip.id} className="bg-white border border-gray-200 rounded-2xl p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-xl font-semibold text-blue-950">{trip.title}</h3>
                    <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                      trip.status === 'open' ? 'bg-green-100 text-green-700' :
                      trip.status === 'assigned' ? 'bg-blue-100 text-blue-900' :
                      trip.status === 'completed' ? 'bg-purple-100 text-purple-700' :
                      'bg-gray-100 text-blue-900'
                    }`}>
                      {trip.status}
                    </span>
                    {trip.payment_status !== 'paid' && (
                      <span
                        className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${
                          trip.payment_status === 'failed'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {trip.payment_status === 'failed' ? 'Payment failed' : 'Payment pending'}
                      </span>
                    )}
                    {trip.payment_status === 'paid' && (
                      <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                        Paid
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-blue-800 mt-1">
                    {trip.pickup_location} → {trip.dropoff_location} • {new Date(trip.pickup_time).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-2 flex-wrap justify-end">
                  {trip.payment_status !== 'paid' && (
                    <button
                      onClick={() => handlePayNow(trip.id)}
                      disabled={processingId === trip.id}
                      className="px-4 py-2 text-sm font-semibold bg-[#1E3A8A] hover:bg-blue-900 text-white rounded-xl transition disabled:opacity-60"
                    >
                      {processingId === trip.id ? 'Redirecting…' : 'Pay Now'}
                    </button>
                  )}
                  <Link
                    href={`/organization/trips/${trip.id}`}
                    className="px-4 py-2 text-sm font-medium bg-[#1E3A8A] hover:bg-blue-900 text-white rounded-xl transition"
                  >
                    View Details
                  </Link>
                  {trip.status === 'open' && (
                    <button onClick={() => handleCancel(trip.id)} disabled={processingId === trip.id} className="px-4 py-1.5 text-sm border border-red-200 text-red-600 rounded-lg hover:bg-red-50">Cancel</button>
                  )}
                  {trip.status === 'assigned' && (
                    <button onClick={() => handleComplete(trip.id, trip.platform_fee || 0)} disabled={processingId === trip.id} className="px-4 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700">Mark Completed</button>
                  )}
                </div>
              </div>

              {trip.description && <p className="text-sm text-blue-900 mb-3">{trip.description}</p>}

              <div className="flex items-center gap-4 text-sm text-blue-800 mb-4">
                {trip.price && <span>Rate: ${trip.price}</span>}
                {trip.distance_miles && <span>Distance: {trip.distance_miles} mi</span>}
                <span>Posted: {new Date(trip.created_at).toLocaleDateString()}</span>
              </div>

              {/* Offers */}
              <div className="border-t pt-4">
                <h4 className="font-medium text-blue-950 mb-3">Offers ({trip.offers?.length || 0})</h4>
                {!trip.offers || trip.offers.length === 0 ? (
                  <p className="text-sm text-blue-900 italic">No offers yet.</p>
                ) : (
                  <div className="space-y-3">
                    {trip.offers.map((offer) => (
                      <div key={offer.id} className="p-4 bg-gray-50 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1">
                            <DriverAvatar photoPath={offer.driver_photo_url} size={28} />
                            <span className="font-medium text-blue-950">{offer.driver_name}</span>
                            {offer.driverRating && (offer.reviewCount || 0) > 0 && (
                              <span className="text-xs text-yellow-500 font-medium">
                                ★ {offer.driverRating} ({offer.reviewCount})
                              </span>
                            )}
                            <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${
                              offer.status === 'approved' ? 'bg-green-100 text-green-700' :
                              offer.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                            }`}>
                              {offer.status}
                            </span>
                          </div>
                          <VehiclePhotos photoPaths={offer.vehicle_photos || []} maxDisplay={1} />
                          {offer.offered_price != null && (
                            <p className="text-sm font-medium text-blue-950">
                              Offered rate: ${offer.offered_price}
                            </p>
                          )}
                          {offer.message && <p className="text-sm text-blue-900 italic">“{offer.message}”</p>}
                          <p className="text-xs text-blue-900 mt-1">Submitted {new Date(offer.created_at).toLocaleDateString()}</p>
                        </div>

                        {trip.status === 'open' && offer.status === 'pending' && (
                          <div className="flex gap-2 flex-shrink-0">
                            <button onClick={() => handleApprove(trip.id, offer.id)} disabled={!!processingId} className="px-5 py-2 text-sm font-medium bg-green-600 hover:bg-green-700 text-white rounded-xl transition disabled:opacity-60">Approve</button>
                            <button onClick={() => handleReject(offer.id)} disabled={!!processingId} className="px-5 py-2 text-sm font-medium border border-red-300 text-red-600 hover:bg-red-50 rounded-xl transition disabled:opacity-60">Reject</button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Details Modal with Map */}
      {selectedTrip && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-auto">
            <div className="p-6 border-b flex justify-between items-center">
              <h3 className="text-2xl font-semibold">{selectedTrip.title}</h3>
              <button onClick={closeDetails} className="text-2xl">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <div className="text-sm font-medium text-blue-800 mb-2">Route</div>
                <TripMap pickup={selectedTrip.pickup_location} dropoff={selectedTrip.dropoff_location} />
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm text-blue-900">
                <div><strong>Pickup:</strong> {selectedTrip.pickup_location}</div>
                <div><strong>Dropoff:</strong> {selectedTrip.dropoff_location}</div>
                <div><strong>Time:</strong> {new Date(selectedTrip.pickup_time).toLocaleString()}</div>
                <div><strong>Rate:</strong> ${selectedTrip.final_price || selectedTrip.price}</div>
              </div>
              {selectedTrip.description && <p className="text-blue-900"><strong>Description:</strong> {selectedTrip.description}</p>}
              <div className="text-blue-900">
                <strong>Status:</strong> <span className="font-medium">{selectedTrip.status}</span>
                {selectedTrip.payment_status === 'unpaid' && <span className="ml-2 text-red-600">(Payment pending)</span>}
              </div>

              {selectedTrip.status !== 'open' && selectedTrip.assigned_driver_id && (
                <div>
                  <div className="text-sm font-medium text-blue-800 mb-2">Assigned Driver</div>
                  <div className="flex items-center gap-3">
                    <DriverAvatar photoPath={selectedTrip.assigned_driver_photo || null} size={40} />
                    <span>{selectedTrip.assigned_driver_name || 'Driver'}</span>
                  </div>
                  {selectedTrip.assigned_vehicle_photos && selectedTrip.assigned_vehicle_photos.length > 0 && (
                    <VehiclePhotos photoPaths={selectedTrip.assigned_vehicle_photos} maxDisplay={2} />
                  )}
                </div>
              )}

              {selectedTrip.status === 'completed' && selectedTrip.assigned_driver_id && (
                <div className="pt-4 border-t">
                  <h4 className="font-medium text-blue-950 mb-2">Review the Driver</h4>
                  {currentReview ? (
                    <div className="bg-green-50 p-3 rounded">
                      <div className="flex items-center gap-2">
                        <span className="text-yellow-500">{'★'.repeat(currentReview.rating)}{'☆'.repeat(5 - currentReview.rating)}</span>
                        <span className="text-sm text-blue-800">Your review</span>
                      </div>
                      {currentReview.review && <p className="text-sm mt-1 italic">“{currentReview.review}”</p>}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex gap-1 text-2xl">
                        {[1,2,3,4,5].map(r => (
                          <button key={r} type="button" onClick={() => setReviewRating(r)} className={r <= reviewRating ? 'text-yellow-400' : 'text-slate-400'}>★</button>
                        ))}
                      </div>
                      <textarea 
                        value={reviewText} 
                        onChange={e => setReviewText(e.target.value)} 
                        placeholder="Optional review (what went well, any notes for future...)" 
                        className="w-full border rounded p-2 text-sm text-blue-950 placeholder:text-blue-700" 
                        rows={2} 
                      />
                      <button 
                        onClick={submitReview} 
                        disabled={submittingReview}
                        className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                      >
                        {submittingReview ? 'Submitting...' : 'Submit Review'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="p-6 border-t">
              <button onClick={closeDetails} className="w-full py-2 border rounded-xl">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

