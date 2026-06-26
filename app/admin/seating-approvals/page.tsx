'use client';

import { useState, useEffect } from 'react';

interface PendingVehicle {
  id: string;
  full_name: string | null;
  phone?: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_year: number | null;
  passenger_capacity: number | null;
  seating_override_note?: string | null;
  updated_at?: string;
  suggested_passengers?: number | null;
  suggested_total_seats?: number | null;
  suggestion_message?: string;
}

export default function SeatingReviewPage() {
  const [vehicles, setVehicles] = useState<PendingVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchPending = async () => {
    setError(null);
    const res = await fetch('/api/admin/pending-vehicles', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      setVehicles(Array.isArray(data) ? data : []);
    } else {
      const err = await res.json().catch(() => ({}));
      setError(err.error || 'Failed to load pending reviews');
      setVehicles([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPending();
  }, []);

  const handleReview = async (profileId: string, status: 'approved' | 'rejected') => {
    setProcessingId(profileId);
    const res = await fetch('/api/admin/vehicle-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profileId, status }),
    });

    if (res.ok) {
      setVehicles((prev) => prev.filter((v) => v.id !== profileId));
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.error || 'Failed to update status');
    }
    setProcessingId(null);
  };

  return (
    <div>
      <h1 className="text-3xl font-bold text-blue-950 mb-2">Seating Capacity Review</h1>
      <p className="text-blue-800 mb-8">
        Approve or reject driver seating overrides before they can submit trip offers.
      </p>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex justify-between gap-4">
          <span>{error}</span>
          <button onClick={fetchPending} className="font-medium hover:underline shrink-0">
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-blue-800">Loading...</p>
      ) : vehicles.length === 0 ? (
        <div className="bg-white border border-blue-100 rounded-2xl p-16 text-center shadow-sm">
          <div className="text-6xl mb-4">✅</div>
          <h3 className="text-2xl font-semibold text-blue-950">No pending reviews</h3>
          <p className="text-blue-800 mt-3">
            All driver seating capacities are currently approved.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {vehicles.map((v) => (
            <div key={v.id} className="border border-blue-100 rounded-2xl p-6 bg-white shadow-sm">
              <div className="flex justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-lg text-blue-950">
                    {v.vehicle_year} {v.vehicle_make} {v.vehicle_model}
                  </h3>
                  <p className="text-blue-800">Driver: {v.full_name || 'Unnamed Driver'}</p>
                  {v.phone && <p className="text-sm text-blue-700">{v.phone}</p>}
                </div>
                <span className="px-4 py-1 h-fit bg-yellow-100 text-yellow-700 text-sm rounded-full">
                  Pending Review
                </span>
              </div>

              <div className="mt-6">
                <div className="text-3xl font-bold text-blue-950">
                  {v.passenger_capacity ?? '—'}{' '}
                  <span className="text-lg font-normal text-blue-700">passengers</span>
                </div>
                {v.suggested_passengers != null && (
                  <p className="text-sm text-blue-800 mt-2">
                    Suggested: <strong>{v.suggested_passengers}</strong> passengers
                    {v.suggested_total_seats != null && (
                      <span> ({v.suggested_total_seats} total seats − 1 driver)</span>
                    )}
                  </p>
                )}
              </div>

              {v.seating_override_note && (
                <p className="mt-4 text-sm text-blue-800 italic border-l-2 border-amber-300 pl-3">
                  Note: {v.seating_override_note}
                </p>
              )}

              {v.suggestion_message && (
                <p className="mt-3 text-xs text-blue-600">{v.suggestion_message}</p>
              )}

              <div className="grid grid-cols-2 gap-4 mt-8">
                <button
                  onClick={() => handleReview(v.id, 'approved')}
                  disabled={processingId === v.id}
                  className="py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium disabled:opacity-60"
                >
                  {processingId === v.id ? 'Processing…' : 'Approve'}
                </button>
                <button
                  onClick={() => handleReview(v.id, 'rejected')}
                  disabled={processingId === v.id}
                  className="py-3 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl font-medium disabled:opacity-60"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}