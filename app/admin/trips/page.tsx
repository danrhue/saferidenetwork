'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AdminTripRow } from '@/lib/driver-profile';
import ShowDeletedToggle from '@/components/admin/ShowDeletedToggle';
import SoftDeleteConfirmModal from '@/components/admin/SoftDeleteConfirmModal';
import { useSoftDelete } from '@/lib/admin/use-soft-delete';
import AdminPageHeader from '@/components/admin/AdminPageHeader';

export default function AdminTripsPage() {
  const [trips, setTrips] = useState<AdminTripRow[]>([]);
  const [showDeleted, setShowDeleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = showDeleted ? '?showDeleted=true' : '';
      const res = await fetch(`/api/admin/trips${qs}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load trips');
      setTrips(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load trips');
    } finally {
      setLoading(false);
    }
  }, [showDeleted]);

  useEffect(() => {
    load();
  }, [load]);

  const softDelete = useSoftDelete(load);

  if (loading) {
    return <div className="text-blue-800">Loading trips...</div>;
  }

  return (
    <div>
      <AdminPageHeader
        title="Trips"
        subtitle={showDeleted ? 'Soft-deleted trips' : 'All active trips on the platform'}
      />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <p className="text-gray-600">{trips.length} trip(s)</p>
        <ShowDeletedToggle checked={showDeleted} onChange={setShowDeleted} />
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {softDelete.error && <p className="mb-4 text-sm text-red-600">{softDelete.error}</p>}

      <div className="overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px]">
            <thead className="bg-blue-50">
              <tr>
                <th className="p-4 text-left text-sm font-semibold text-blue-950">Trip</th>
                <th className="p-4 text-left text-sm font-semibold text-blue-950">Status</th>
                <th className="p-4 text-left text-sm font-semibold text-blue-950">Organization</th>
                <th className="p-4 text-left text-sm font-semibold text-blue-950">Driver</th>
                <th className="p-4 text-left text-sm font-semibold text-blue-950">Created</th>
                <th className="p-4 text-left text-sm font-semibold text-blue-950">Actions</th>
              </tr>
            </thead>
            <tbody>
              {trips.length > 0 ? (
                trips.map((trip) => (
                  <tr key={trip.id} className="border-t border-blue-50 hover:bg-gray-50">
                    <td className="p-4">
                      <div className="font-medium text-blue-950">{trip.title}</div>
                      <div className="text-xs text-gray-500">
                        {trip.pickup_location} → {trip.dropoff_location}
                      </div>
                    </td>
                    <td className="p-4 text-sm capitalize text-gray-700">{trip.status}</td>
                    <td className="p-4 text-sm text-gray-600">{trip.organization_name || '—'}</td>
                    <td className="p-4 text-sm text-gray-600">{trip.driver_name || '—'}</td>
                    <td className="p-4 text-sm text-gray-500">
                      {trip.created_at ? new Date(trip.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="p-4">
                      {!showDeleted && (
                        <button
                          type="button"
                          onClick={() =>
                            softDelete.requestDelete({
                              entityType: 'trip',
                              id: trip.id,
                              label: trip.title,
                            })
                          }
                          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-blue-700">
                    No trips found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <SoftDeleteConfirmModal
        open={Boolean(softDelete.pending)}
        title="Delete trip?"
        description="This trip will be hidden from drivers, organizations, and riders. It can be restored later."
        entityLabel={softDelete.pending?.label ?? ''}
        loading={softDelete.loading}
        onConfirm={softDelete.confirmDelete}
        onCancel={softDelete.cancelDelete}
      />
    </div>
  );
}