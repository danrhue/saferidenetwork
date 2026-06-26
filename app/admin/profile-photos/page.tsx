'use client';

import { useEffect, useState } from 'react';

type PendingDriverPhoto = {
  id: string;
  full_name: string | null;
  phone?: string | null;
  email?: string | null;
  profile_photo_url: string | null;
  photo_url: string | null;
  updated_at?: string;
};

export default function ProfilePhotoReviewPage() {
  const [drivers, setDrivers] = useState<PendingDriverPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const fetchPending = async () => {
    setError(null);
    const res = await fetch('/api/admin/pending-profile-photos', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      setDrivers(Array.isArray(data) ? data : []);
    } else {
      const err = await res.json().catch(() => ({}));
      setError(err.error || 'Failed to load pending profile photos');
      setDrivers([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPending();
  }, []);

  const handleApprove = async (profileId: string) => {
    setProcessingId(profileId);
    const res = await fetch('/api/admin/profile-photo-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profileId, status: 'approved' }),
    });

    if (res.ok) {
      setDrivers((prev) => prev.filter((d) => d.id !== profileId));
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.error || 'Failed to approve photo');
    }
    setProcessingId(null);
  };

  const openReject = (profileId: string) => {
    setRejectingId(profileId);
    setRejectReason('');
  };

  const handleReject = async () => {
    if (!rejectingId) return;
    const trimmed = rejectReason.trim();
    if (!trimmed) {
      alert('Please provide a rejection reason for the driver.');
      return;
    }

    setProcessingId(rejectingId);
    const res = await fetch('/api/admin/profile-photo-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profileId: rejectingId,
        status: 'rejected',
        reason: trimmed,
      }),
    });

    if (res.ok) {
      setDrivers((prev) => prev.filter((d) => d.id !== rejectingId));
      setRejectingId(null);
      setRejectReason('');
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.error || 'Failed to reject photo');
    }
    setProcessingId(null);
  };

  return (
    <div>
      <h1 className="text-3xl font-bold text-blue-950 mb-2">Profile Photo Review</h1>
      <p className="text-blue-800 mb-8">
        Approve or reject driver profile photos before they appear to riders and organizations.
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
        <p className="text-blue-800">Loading…</p>
      ) : drivers.length === 0 ? (
        <div className="bg-white border border-blue-100 rounded-2xl p-16 text-center shadow-sm">
          <div className="text-6xl mb-4">✅</div>
          <h3 className="text-2xl font-semibold text-blue-950">No pending photos</h3>
          <p className="text-blue-800 mt-3">All driver profile photos have been reviewed.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {drivers.map((driver) => (
            <div
              key={driver.id}
              className="border border-blue-100 rounded-2xl p-6 bg-white shadow-sm flex flex-col"
            >
              <div className="flex justify-between gap-3 items-start mb-4">
                <div>
                  <h3 className="font-semibold text-lg text-blue-950">
                    {driver.full_name || 'Unnamed Driver'}
                  </h3>
                  {driver.email && (
                    <p className="text-sm text-blue-700">{driver.email}</p>
                  )}
                  {driver.phone && (
                    <p className="text-sm text-blue-600">{driver.phone}</p>
                  )}
                </div>
                <span className="px-3 py-1 h-fit bg-amber-100 text-amber-800 text-xs font-medium rounded-full border border-amber-200">
                  Pending
                </span>
              </div>

              <div className="flex-1 flex items-center justify-center my-4">
                {driver.photo_url ? (
                  <img
                    src={driver.photo_url}
                    alt={`Profile photo for ${driver.full_name || 'driver'}`}
                    className="w-40 h-40 rounded-full object-cover border-4 border-blue-100 shadow-md"
                  />
                ) : (
                  <div className="w-40 h-40 rounded-full bg-gray-100 flex items-center justify-center text-4xl text-gray-300">
                    👤
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 mt-4">
                <button
                  onClick={() => handleApprove(driver.id)}
                  disabled={processingId === driver.id}
                  className="py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium disabled:opacity-60"
                >
                  {processingId === driver.id ? 'Processing…' : 'Approve'}
                </button>
                <button
                  onClick={() => openReject(driver.id)}
                  disabled={processingId === driver.id}
                  className="py-3 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl font-medium disabled:opacity-60"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {rejectingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-semibold text-blue-950 mb-2">Reject Profile Photo</h2>
            <p className="text-sm text-blue-800 mb-4">
              Provide a clear reason so the driver knows what to fix before re-uploading.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
              placeholder="e.g. Photo is too dark, face not clearly visible, or includes sunglasses."
              className="w-full border border-blue-200 rounded-xl p-3 text-sm text-blue-950 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => {
                  setRejectingId(null);
                  setRejectReason('');
                }}
                className="flex-1 py-2.5 border border-blue-200 text-blue-800 rounded-xl hover:bg-blue-50"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={processingId === rejectingId}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium disabled:opacity-60"
              >
                {processingId === rejectingId ? 'Rejecting…' : 'Reject Photo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}