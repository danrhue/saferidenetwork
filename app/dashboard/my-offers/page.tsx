'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { getErrorMessage } from '@/lib/errors';
import { authFetch } from '@/lib/auth-fetch';
import OrganizationLogo from '../../components/OrganizationLogo';

interface OfferRow {
  id: string;
  status: string;
  message: string | null;
  offered_price: number | null;
  created_at: string;
  trip_id: string;
}

interface TripSummary {
  id: string;
  title: string;
  pickup_location: string;
  dropoff_location: string;
  pickup_time: string;
  status: string;
  organization_id: string;
  distance_miles: number | null;
  price: number | null;
  final_price: number | null;
  passengers: number | null;
}

interface Offer {
  id: string;
  status: string;
  message: string | null;
  offered_price: number | null;
  created_at: string;
  trip: TripSummary & {
    organization_name?: string;
    organization_photo_url?: string | null;
  };
}

interface AssignedTrip {
  id: string;
  title: string;
  pickup_location: string;
  dropoff_location: string;
  pickup_time: string;
  status: string;
  passengers: number | null;
  description: string | null;
  organization_name?: string;
  organization_photo_url?: string | null;
}

function formatCurrency(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  return Number(value).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  });
}

function formatPickupDateTime(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }),
    time: d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
  };
}

function offerStatusLabel(status: string): string {
  if (status === 'approved') return 'Approved';
  if (status === 'rejected') return 'Rejected';
  return 'Pending Review';
}

function OfferStatusBadge({ status }: { status: string }) {
  const styles =
    status === 'approved'
      ? 'bg-green-100 text-green-800 border-green-200'
      : status === 'rejected'
        ? 'bg-red-50 text-red-700 border-red-200'
        : 'bg-amber-50 text-amber-800 border-amber-200';

  return (
    <span className={`inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full border ${styles}`}>
      {offerStatusLabel(status)}
    </span>
  );
}

export default function MyOffers() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [activeTrips, setActiveTrips] = useState<AssignedTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [withdrawing, setWithdrawing] = useState<string | null>(null);
  const [editingOffer, setEditingOffer] = useState<Offer | null>(null);
  const [editMessage, setEditMessage] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError('Please sign in to view your offers.');
        setLoading(false);
        return;
      }

      const { data: offersData, error: offersError } = await supabase
        .from('trip_offers')
        .select('id, status, message, offered_price, created_at, trip_id')
        .eq('driver_id', user.id)
        .order('created_at', { ascending: false });

      if (offersError) {
        throw new Error(`Could not load offers: ${offersError.message}`);
      }

      const offerRows = (offersData || []) as OfferRow[];
      const tripIds = [...new Set(offerRows.map((o) => o.trip_id))];

      const tripMap: Record<string, TripSummary> = {};
      const profileMap: Record<
        string,
        { organization_name?: string; profile_photo_url?: string | null }
      > = {};

      if (tripIds.length > 0) {
        const { data: tripsData, error: tripsError } = await supabase
          .from('trips')
          .select(
            'id, title, pickup_location, dropoff_location, pickup_time, status, organization_id, distance_miles, price, final_price, passengers'
          )
          .in('id', tripIds);

        if (tripsError) {
          throw new Error(`Could not load trip details: ${tripsError.message}`);
        }

        (tripsData || []).forEach((t) => {
          tripMap[t.id] = t as TripSummary;
        });

        const orgIds = [...new Set((tripsData || []).map((t) => t.organization_id))];
        if (orgIds.length > 0) {
          const { data: profilesData, error: profilesError } = await supabase
            .from('profiles')
            .select('id, organization_name, full_name, profile_photo_url')
            .in('id', orgIds);

          if (profilesError) {
            console.error('Profiles fetch error:', profilesError);
          } else {
            (profilesData || []).forEach((p) => {
              profileMap[p.id] = {
                organization_name: p.organization_name || p.full_name || 'Organization',
                profile_photo_url: p.profile_photo_url,
              };
            });
          }
        }
      }

      const formattedOffers = offerRows.reduce<Offer[]>((acc, offer) => {
        const trip = tripMap[offer.trip_id];
        if (!trip) return acc;
        const profile = profileMap[trip.organization_id];
        acc.push({
          id: offer.id,
          status: offer.status,
          message: offer.message,
          offered_price: offer.offered_price,
          created_at: offer.created_at,
          trip: {
            ...trip,
            organization_name: profile?.organization_name || 'Organization',
            organization_photo_url: profile?.profile_photo_url || null,
          },
        });
        return acc;
      }, []);

      setOffers(formattedOffers);

      const { data: tripsData, error: tripsError } = await supabase
        .from('trips')
        .select(
          'id, title, pickup_location, dropoff_location, pickup_time, status, passengers, description, organization_id'
        )
        .eq('assigned_driver_id', user.id)
        .in('status', ['assigned', 'in_progress'])
        .order('pickup_time', { ascending: true });

      if (tripsError) {
        console.error('Active trips fetch error:', tripsError);
      } else {
        const orgIds = [...new Set((tripsData || []).map((t) => t.organization_id))];
        const activeProfileMap: Record<
          string,
          { organization_name?: string; profile_photo_url?: string | null }
        > = {};

        if (orgIds.length > 0) {
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('id, organization_name, full_name, profile_photo_url')
            .in('id', orgIds);

          (profilesData || []).forEach((p) => {
            activeProfileMap[p.id] = {
              organization_name: p.organization_name || p.full_name || 'Organization',
              profile_photo_url: p.profile_photo_url,
            };
          });
        }

        const formattedActive = (tripsData || []).map((t) => {
          const profile = activeProfileMap[t.organization_id];
          return {
            ...t,
            organization_name: profile?.organization_name || 'Organization',
            organization_photo_url: profile?.profile_photo_url || null,
          };
        });
        setActiveTrips(formattedActive as AssignedTrip[]);
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err));
      setOffers([]);
      setActiveTrips([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openEditOffer = (offer: Offer) => {
    setEditingOffer(offer);
    setEditMessage(offer.message || '');
    setEditPrice(
      offer.offered_price != null
        ? String(offer.offered_price)
        : ''
    );
    setEditError(null);
  };

  const closeEditOffer = () => {
    setEditingOffer(null);
    setEditMessage('');
    setEditPrice('');
    setEditError(null);
  };

  const saveEditOffer = async () => {
    if (!editingOffer) return;
    setSavingEdit(true);
    setEditError(null);
    try {
      const response = await authFetch('/api/trip-offers', {
        method: 'PATCH',
        body: JSON.stringify({
          offerId: editingOffer.id,
          message: editMessage,
          offeredPrice: editPrice ? Number(editPrice) : undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Update failed');
      closeEditOffer();
      await fetchData();
      alert('Offer updated.');
    } catch (err: unknown) {
      setEditError(getErrorMessage(err));
    } finally {
      setSavingEdit(false);
    }
  };

  const withdrawOffer = async (offerId: string) => {
    if (!confirm('Withdraw this offer? This cannot be undone.')) return;

    setWithdrawing(offerId);

    try {
      const { error: deleteError } = await supabase
        .from('trip_offers')
        .delete()
        .eq('id', offerId)
        .eq('status', 'pending');

      if (deleteError) throw deleteError;

      alert('Offer withdrawn.');
      await fetchData();
    } catch (err: unknown) {
      alert('Failed to withdraw offer: ' + getErrorMessage(err));
    } finally {
      setWithdrawing(null);
    }
  };

  const getTripStatusBadge = (status: string) => {
    if (status === 'assigned') return 'bg-green-100 text-green-800 border-green-200';
    if (status === 'in_progress') return 'bg-blue-100 text-blue-800 border-blue-200';
    if (status === 'open') return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    if (status === 'completed') return 'bg-purple-50 text-purple-800 border-purple-200';
    return 'bg-gray-100 text-gray-700 border-gray-200';
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="h-10 w-10 rounded-full border-2 border-[#1E3A8A] border-t-transparent animate-spin mb-4" />
        <p className="text-blue-950 font-medium">Loading your offers...</p>
        <p className="text-sm text-blue-700 mt-1">Fetching trip and organization details</p>
      </div>
    );
  }

  const hasActive = activeTrips.length > 0;

  return (
    <div className="max-w-4xl mx-auto pb-12">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-blue-950">My Offers</h1>
          <p className="text-blue-800 mt-1">
            Track submitted offers and access active assigned trips.
          </p>
        </div>
        <Link
          href="/dashboard/trips"
          className="inline-flex items-center justify-center px-5 py-2.5 bg-[#1E3A8A] hover:bg-blue-900 text-white rounded-xl text-sm font-medium transition"
        >
          Browse Available Trips
        </Link>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-start justify-between gap-4">
          <span>{error}</span>
          <button
            onClick={fetchData}
            className="shrink-0 text-sm font-medium text-red-800 hover:underline"
          >
            Retry
          </button>
        </div>
      )}

      {hasActive && (
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-lg font-semibold text-blue-950">
              Active Trip{activeTrips.length > 1 ? 's' : ''}
            </h2>
            <span className="px-2.5 py-0.5 text-xs rounded-full bg-green-100 text-green-700 font-semibold border border-green-200">
              Ready
            </span>
          </div>

          <div className="space-y-4">
            {activeTrips.map((trip) => (
              <div
                key={trip.id}
                className="bg-white border-2 border-[#1E3A8A] rounded-2xl p-6 shadow-sm"
              >
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-5">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-3">
                      <OrganizationLogo photoPath={trip.organization_photo_url} size={40} />
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-blue-700">
                          Organization
                        </p>
                        <p className="font-semibold text-blue-950">
                          {trip.organization_name || 'Organization'}
                        </p>
                      </div>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">{trip.title}</h3>
                    <p className="text-gray-700">
                      <span className="font-medium text-green-700">Pickup</span>{' '}
                      {trip.pickup_location}
                      <span className="mx-2 text-[#1E3A8A]">→</span>
                      <span className="font-medium text-red-600">Dropoff</span>{' '}
                      {trip.dropoff_location}
                    </p>
                    <p className="text-sm text-gray-600">
                      {new Date(trip.pickup_time).toLocaleString()} • {trip.passengers || 1}{' '}
                      passenger{(trip.passengers || 1) !== 1 ? 's' : ''}
                    </p>
                    {trip.description && (
                      <p className="text-sm text-gray-600 bg-blue-50 rounded-xl p-3 border border-blue-100">
                        {trip.description}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col items-stretch md:items-end gap-3">
                    <span
                      className={`inline-flex self-start md:self-end px-3 py-1 rounded-full text-xs font-semibold border ${getTripStatusBadge(trip.status)}`}
                    >
                      {trip.status === 'assigned' ? 'Assigned — Ready to Start' : 'In Progress'}
                    </span>
                    <Link
                      href={`/dashboard/trip/${trip.id}`}
                      className="inline-flex items-center justify-center px-8 py-3.5 bg-[#1E3A8A] hover:bg-blue-900 text-white font-semibold rounded-xl transition shadow-sm"
                    >
                      Open Trip Screen →
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-blue-950">All My Offers</h2>
          <p className="text-sm text-blue-800">
            {offers.length === 0
              ? 'No offers yet — browse open trips to submit your first offer.'
              : `${offers.length} offer${offers.length !== 1 ? 's' : ''} submitted`}
          </p>
        </div>

        {offers.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center shadow-sm">
            <div className="text-4xl mb-3">📋</div>
            <h3 className="text-xl font-semibold text-blue-950 mb-2">No offers submitted yet</h3>
            <p className="text-blue-800 max-w-md mx-auto">
              When you submit offers on open trips, they will appear here with route details, rates,
              and status updates from organizations.
            </p>
            <Link
              href="/dashboard/trips"
              className="mt-6 inline-block px-6 py-2.5 bg-[#1E3A8A] hover:bg-blue-900 text-white rounded-xl text-sm font-medium transition"
            >
              Browse Available Trips
            </Link>
          </div>
        ) : (
          <div className="space-y-5">
            {offers.map((offer) => {
              const postedRate = offer.trip.final_price ?? offer.trip.price;
              const yourOffer = offer.offered_price ?? postedRate;
              const { date, time } = formatPickupDateTime(offer.trip.pickup_time);

              return (
                <article
                  key={offer.id}
                  className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                >
                  {/* Card header: organization + status */}
                  <div className="px-5 py-4 bg-gradient-to-r from-blue-50 to-white border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <OrganizationLogo photoPath={offer.trip.organization_photo_url} size={44} />
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-700">
                          Organization
                        </p>
                        <p className="font-bold text-lg text-blue-950 truncate">
                          {offer.trip.organization_name}
                        </p>
                        <p className="text-sm text-gray-600 truncate">{offer.trip.title}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <OfferStatusBadge status={offer.status} />
                      <span
                        className={`px-2.5 py-1 text-[11px] font-medium rounded-full border capitalize ${getTripStatusBadge(offer.trip.status)}`}
                      >
                        Trip: {offer.trip.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>

                  {/* Trip details grid */}
                  <div className="p-5 grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2 rounded-xl bg-gray-50 border border-gray-100 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-2">
                        Route
                      </p>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-blue-950">
                        <span className="font-medium">
                          <span className="text-green-700 text-xs font-semibold mr-1">A</span>
                          {offer.trip.pickup_location}
                        </span>
                        <span className="hidden sm:inline text-[#1E3A8A] font-bold">→</span>
                        <span className="font-medium">
                          <span className="text-red-600 text-xs font-semibold mr-1">B</span>
                          {offer.trip.dropoff_location}
                        </span>
                      </div>
                    </div>

                    <div className="rounded-xl border border-gray-100 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1">
                        Date &amp; Time
                      </p>
                      <p className="font-semibold text-blue-950">{date}</p>
                      <p className="text-sm text-blue-800 mt-0.5">{time}</p>
                    </div>

                    <div className="rounded-xl border border-gray-100 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1">
                        Distance &amp; Posted Rate
                      </p>
                      <p className="text-sm text-blue-900">
                        {offer.trip.distance_miles != null
                          ? `${offer.trip.distance_miles} mi`
                          : 'Distance not listed'}
                      </p>
                      <p className="font-semibold text-blue-950 mt-1">
                        Posted rate: {formatCurrency(postedRate)}
                      </p>
                    </div>

                    <div className="sm:col-span-2 rounded-xl bg-[#1E3A8A]/5 border-2 border-[#1E3A8A]/20 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-[#1E3A8A] mb-1">
                          Your Offer
                        </p>
                        <p className="text-2xl font-bold text-[#1E3A8A]">
                          You offered: {formatCurrency(yourOffer)}
                        </p>
                        {offer.offered_price == null && postedRate != null && (
                          <p className="text-xs text-blue-700 mt-1">
                            Matches posted rate (no custom amount recorded)
                          </p>
                        )}
                      </div>
                      {offer.trip.passengers != null && (
                        <p className="text-sm text-blue-800 shrink-0">
                          {offer.trip.passengers} passenger
                          {offer.trip.passengers !== 1 ? 's' : ''}
                        </p>
                      )}
                    </div>
                  </div>

                  {offer.message && (
                    <div className="px-5 pb-4">
                      <div className="rounded-xl bg-gray-50 border border-gray-100 p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1">
                          Your Message
                        </p>
                        <p className="text-sm text-gray-800 italic">&ldquo;{offer.message}&rdquo;</p>
                      </div>
                    </div>
                  )}

                  {/* Card footer */}
                  <div className="px-5 py-4 bg-gray-50 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <p className="text-xs text-gray-500">
                      Submitted{' '}
                      {new Date(offer.created_at).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </p>

                    <div className="flex items-center gap-3">
                      {offer.status === 'pending' && (
                        <>
                          <button
                            onClick={() => openEditOffer(offer)}
                            className="px-4 py-2 text-sm font-medium text-[#1E3A8A] bg-white border border-blue-200 rounded-xl hover:bg-blue-50 transition"
                          >
                            Edit Offer
                          </button>
                          <button
                            onClick={() => withdrawOffer(offer.id)}
                            disabled={withdrawing === offer.id}
                            className="px-4 py-2 text-sm font-medium text-red-700 bg-white border border-red-200 rounded-xl hover:bg-red-50 hover:border-red-300 disabled:opacity-50 transition"
                          >
                            {withdrawing === offer.id ? 'Withdrawing…' : 'Withdraw'}
                          </button>
                        </>
                      )}

                      {offer.status === 'approved' &&
                        (offer.trip.status === 'assigned' ||
                          offer.trip.status === 'in_progress') && (
                          <Link
                            href={`/dashboard/trip/${offer.trip.id}`}
                            className="px-4 py-2 text-sm font-semibold text-white bg-[#1E3A8A] hover:bg-blue-900 rounded-xl transition"
                          >
                            Go to Trip Screen →
                          </Link>
                        )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {editingOffer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-blue-950 mb-4">Edit Pending Offer</h3>
            <p className="text-sm text-blue-800 mb-4">{editingOffer.trip.title}</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-blue-950 mb-1">Offered Rate ($)</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={editPrice}
                  onChange={(e) => setEditPrice(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-blue-950 mb-1">Message</label>
                <textarea
                  value={editMessage}
                  onChange={(e) => setEditMessage(e.target.value)}
                  rows={3}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2"
                />
              </div>
              {editError && (
                <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">
                  {editError}
                </p>
              )}
            </div>
            <div className="mt-6 flex gap-3 justify-end">
              <button
                onClick={closeEditOffer}
                className="px-4 py-2 border rounded-xl text-sm"
              >
                Cancel
              </button>
              <button
                onClick={saveEditOffer}
                disabled={savingEdit || !editPrice}
                className="px-4 py-2 bg-[#1E3A8A] text-white rounded-xl text-sm font-medium disabled:opacity-60"
              >
                {savingEdit ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}