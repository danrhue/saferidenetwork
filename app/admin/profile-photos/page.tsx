'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  profilePhotoStatusBadgeClass,
  profilePhotoStatusLabel,
  type ProfilePhotoStatus,
} from '@/lib/profile-photo';

type AuditEntry = {
  id: string;
  profile_id: string;
  admin_id: string;
  action: 'approved' | 'rejected';
  rejection_reason: string | null;
  created_at: string;
  admin_name: string | null;
};

type DriverPhotoRow = {
  id: string;
  full_name: string | null;
  phone?: string | null;
  email?: string | null;
  profile_photo_url: string | null;
  profile_photo_status: string | null;
  profile_photo_rejection_reason?: string | null;
  updated_at?: string;
  photo_url: string | null;
  last_audit: AuditEntry | null;
};

type StatusFilter = 'pending' | 'approved' | 'rejected' | 'all';

function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

export default function ProfilePhotoReviewPage() {
  const [drivers, setDrivers] = useState<DriverPhotoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [processing, setProcessing] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectTargetIds, setRejectTargetIds] = useState<string[]>([]);
  const [rejectReason, setRejectReason] = useState('');

  const pendingDrivers = useMemo(
    () => drivers.filter((d) => d.profile_photo_status === 'pending'),
    [drivers]
  );

  const fetchDrivers = useCallback(async () => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({ status: statusFilter });
    if (dateFrom) params.set('from', dateFrom);
    if (dateTo) params.set('to', dateTo);

    const res = await fetch(`/api/admin/profile-photos?${params.toString()}`, {
      cache: 'no-store',
    });

    if (res.ok) {
      const data = await res.json();
      setDrivers(Array.isArray(data) ? data : []);
      setSelectedIds(new Set());
    } else {
      const err = await res.json().catch(() => ({}));
      setError(err.error || 'Failed to load profile photos');
      setDrivers([]);
    }

    setLoading(false);
  }, [statusFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchDrivers();
  }, [fetchDrivers]);

  const toggleSelect = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleSelectAllPending = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(pendingDrivers.map((d) => d.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const submitReview = async (
    profileIds: string[],
    status: 'approved' | 'rejected',
    reason?: string
  ) => {
    if (profileIds.length === 0) return;

    setProcessing(true);
    const res = await fetch('/api/admin/profile-photo-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profileIds,
        status,
        reason,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert(data.error || 'Review action failed');
      setProcessing(false);
      return;
    }

    if (data.failed?.length) {
      alert(
        `Completed ${data.succeeded?.length ?? 0} review(s). ${data.failed.length} failed.`
      );
    }

    await fetchDrivers();
    setRejectModalOpen(false);
    setRejectTargetIds([]);
    setRejectReason('');
    setProcessing(false);
  };

  const openBulkReject = (ids: string[]) => {
    setRejectTargetIds(ids);
    setRejectReason('');
    setRejectModalOpen(true);
  };

  const handleBulkApprove = () => {
    const ids = [...selectedIds].filter((id) =>
      pendingDrivers.some((d) => d.id === id)
    );
    if (ids.length === 0) {
      alert('Select at least one pending photo.');
      return;
    }
    void submitReview(ids, 'approved');
  };

  const handleBulkReject = () => {
    const ids = [...selectedIds].filter((id) =>
      pendingDrivers.some((d) => d.id === id)
    );
    if (ids.length === 0) {
      alert('Select at least one pending photo.');
      return;
    }
    openBulkReject(ids);
  };

  const allPendingSelected =
    pendingDrivers.length > 0 &&
    pendingDrivers.every((d) => selectedIds.has(d.id));

  return (
    <div>
      <h1 className="text-3xl font-bold text-blue-950 mb-2">Profile Photo Review</h1>
      <p className="text-blue-800 mb-6">
        Review driver profile photos, filter by status or date, and perform bulk approve/reject
        actions. All decisions are recorded in the audit log.
      </p>

      <div className="mb-6 flex flex-wrap gap-4 items-end bg-white border border-blue-100 rounded-2xl p-5 shadow-sm">
        <div>
          <label className="block text-xs font-medium text-blue-800 mb-1">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="border border-blue-200 rounded-xl px-3 py-2 text-sm text-blue-950 min-w-[140px]"
          >
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="all">All</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-blue-800 mb-1">Updated from</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="border border-blue-200 rounded-xl px-3 py-2 text-sm text-blue-950"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-blue-800 mb-1">Updated to</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="border border-blue-200 rounded-xl px-3 py-2 text-sm text-blue-950"
          />
        </div>
        <button
          onClick={() => fetchDrivers()}
          className="px-4 py-2 bg-[#1E3A8A] text-white rounded-xl text-sm font-medium hover:bg-[#162d6b]"
        >
          Apply Filters
        </button>
        <button
          onClick={() => {
            setDateFrom('');
            setDateTo('');
            setStatusFilter('pending');
          }}
          className="px-4 py-2 border border-blue-200 text-blue-800 rounded-xl text-sm hover:bg-blue-50"
        >
          Reset
        </button>
      </div>

      {pendingDrivers.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-4 bg-blue-50 border border-blue-100 rounded-2xl px-5 py-4">
          <label className="flex items-center gap-2 text-sm text-blue-900">
            <input
              type="checkbox"
              checked={allPendingSelected}
              onChange={(e) => toggleSelectAllPending(e.target.checked)}
            />
            Select all pending ({pendingDrivers.length})
          </label>
          <span className="text-sm text-blue-700">{selectedIds.size} selected</span>
          <button
            onClick={handleBulkApprove}
            disabled={processing || selectedIds.size === 0}
            className="px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 disabled:opacity-50"
          >
            Bulk Approve
          </button>
          <button
            onClick={handleBulkReject}
            disabled={processing || selectedIds.size === 0}
            className="px-4 py-2 bg-red-100 text-red-700 rounded-xl text-sm font-medium hover:bg-red-200 disabled:opacity-50"
          >
            Bulk Reject
          </button>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex justify-between gap-4">
          <span>{error}</span>
          <button onClick={fetchDrivers} className="font-medium hover:underline shrink-0">
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-blue-800">Loading…</p>
      ) : drivers.length === 0 ? (
        <div className="bg-white border border-blue-100 rounded-2xl p-16 text-center shadow-sm">
          <div className="text-6xl mb-4">📷</div>
          <h3 className="text-2xl font-semibold text-blue-950">No photos match these filters</h3>
          <p className="text-blue-800 mt-3">Try changing the status or date range.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {drivers.map((driver) => {
            const status = (driver.profile_photo_status ?? null) as ProfilePhotoStatus | null;
            const isPending = status === 'pending';
            const audit = driver.last_audit;

            return (
              <div
                key={driver.id}
                className="border border-blue-100 rounded-2xl p-6 bg-white shadow-sm flex flex-col"
              >
                <div className="flex items-start gap-3 mb-4">
                  {isPending && (
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={selectedIds.has(driver.id)}
                      onChange={(e) => toggleSelect(driver.id, e.target.checked)}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap justify-between gap-2 items-start">
                      <div>
                        <h3 className="font-semibold text-lg text-blue-950 truncate">
                          {driver.full_name || 'Unnamed Driver'}
                        </h3>
                        {driver.email && (
                          <p className="text-sm text-blue-700 truncate">{driver.email}</p>
                        )}
                        {driver.phone && (
                          <p className="text-sm text-blue-600">{driver.phone}</p>
                        )}
                      </div>
                      {status && (
                        <span
                          className={`px-3 py-1 h-fit text-xs font-medium rounded-full border shrink-0 ${profilePhotoStatusBadgeClass(status)}`}
                        >
                          {profilePhotoStatusLabel(status)}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-blue-600 mt-2">
                      Updated {formatDateTime(driver.updated_at)}
                    </p>
                  </div>
                </div>

                <div className="flex-1 flex items-center justify-center my-3">
                  {driver.photo_url ? (
                    <img
                      src={driver.photo_url}
                      alt={`Profile photo for ${driver.full_name || 'driver'}`}
                      className="w-36 h-36 rounded-full object-cover border-4 border-blue-100 shadow-md"
                    />
                  ) : (
                    <div className="w-36 h-36 rounded-full bg-gray-100 flex items-center justify-center text-4xl text-gray-300">
                      👤
                    </div>
                  )}
                </div>

                {status === 'rejected' && driver.profile_photo_rejection_reason && (
                  <p className="text-xs text-red-800 bg-red-50 border border-red-100 rounded-lg p-3 mb-3">
                    <strong>Rejection reason:</strong> {driver.profile_photo_rejection_reason}
                  </p>
                )}

                <div className="mb-4 p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-700">
                  <p className="font-semibold text-slate-900 mb-1">Last review action</p>
                  {audit ? (
                    <>
                      <p>
                        <strong>{audit.action === 'approved' ? 'Approved' : 'Rejected'}</strong>{' '}
                        by {audit.admin_name || 'Admin'} on {formatDateTime(audit.created_at)}
                      </p>
                      {audit.rejection_reason && (
                        <p className="mt-1 text-red-700">{audit.rejection_reason}</p>
                      )}
                    </>
                  ) : (
                    <p>No review recorded yet.</p>
                  )}
                </div>

                {isPending && (
                  <div className="grid grid-cols-2 gap-3 mt-auto">
                    <button
                      onClick={() => submitReview([driver.id], 'approved')}
                      disabled={processing}
                      className="py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-medium disabled:opacity-60"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => openBulkReject([driver.id])}
                      disabled={processing}
                      className="py-2.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl text-sm font-medium disabled:opacity-60"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {rejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-semibold text-blue-950 mb-2">
              Reject {rejectTargetIds.length > 1 ? `${rejectTargetIds.length} Photos` : 'Photo'}
            </h2>
            <p className="text-sm text-blue-800 mb-4">
              Provide a reason shown to the driver(s). Required for every rejection.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
              placeholder="e.g. Face not clearly visible, poor lighting, or includes sunglasses."
              className="w-full border border-blue-200 rounded-xl p-3 text-sm text-blue-950 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => {
                  setRejectModalOpen(false);
                  setRejectTargetIds([]);
                  setRejectReason('');
                }}
                className="flex-1 py-2.5 border border-blue-200 text-blue-800 rounded-xl hover:bg-blue-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const trimmed = rejectReason.trim();
                  if (!trimmed) {
                    alert('Please provide a rejection reason.');
                    return;
                  }
                  void submitReview(rejectTargetIds, 'rejected', trimmed);
                }}
                disabled={processing}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium disabled:opacity-60"
              >
                {processing ? 'Rejecting…' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}