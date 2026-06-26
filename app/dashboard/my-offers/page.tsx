'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { getErrorMessage } from '@/lib/errors';
import { authFetch } from '@/lib/auth-fetch';
import OrganizationLogo from '../../components/OrganizationLogo';
import {
  fetchDriverAssignedTrips,
  fetchDriverPendingOffers,
  getTripStatusBadgeClass,
  type DriverOffer,
} from '@/lib/driver/driver-trip-lists';

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
  const [offers, setOffers] = useState<DriverOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [withdrawing, setWithdrawing] = useState<string | null>(null);
  const [editingOffer, setEditingOffer] = useState<DriverOffer | null>(null);
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

      const assignedTrips = await fetchDriverAssignedTrips(supabase, user.id);
      const assignedTripIds = new Set(assignedTrips.map((t) => t.id));
      const pendingOffers = await fetchDriverPendingOffers(
        supabase,
        user.id,
        assignedTripIds
      );

      setOffers(pendingOffers);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
      setOffers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openEditOffer = (offer: DriverOffer) => {
    setEditingOffer(offer);
    setEditMessage(offer.message || '');
    setEditPrice(offer.offered_price != null ? String(offer.offered_price) : '');
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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="h-10 w-10 rounded-full border-2 border-[#1E3A8A] border-t-transparent animate-spin mb-4" />
        <p className="text-blue-950 font-medium">Loading your offers...</p>
        <p className="text-sm text-blue-700 mt-1">Fetching trip and organization details</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-12">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-blue-950">My Offers</h1>
          <p className="text-blue-800 mt-1">
            Trips you have offered on. You will be notified if an organization assigns one to you.
            Assigned trips appear under{' '}
            <Link href="/dashboard/active-trips" className="font-medium text-[#1E3A8A] hover:underline">
              Active Trips
            </Link>
            .
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
                      className={`px-2.5 py-1 text-[11px] font-medium rounded-full border capitalize ${getTripStatusBadgeClass(offer.trip.status)}`}
                    >
                      Trip: {offer.trip.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>

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

                  {offer.status === 'pending' && (
                    <div className="flex items-center gap-3">
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
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

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
              <button onClick={closeEditOffer} className="px-4 py-2 border rounded-xl text-sm">
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