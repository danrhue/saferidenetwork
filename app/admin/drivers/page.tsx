'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { DriverProfileRow } from '@/lib/driver-profile';
import AdminImagePreviewModal from '@/components/admin/AdminImagePreviewModal';
import { formatAdminDriverName } from '@/components/admin/admin-driver-utils';
import ShowDeletedToggle from '@/components/admin/ShowDeletedToggle';
import SoftDeleteConfirmModal from '@/components/admin/SoftDeleteConfirmModal';
import { useSoftDelete } from '@/lib/admin/use-soft-delete';

export default function AdminDriversPage() {
  const [drivers, setDrivers] = useState<DriverProfileRow[]>([]);
  const [showDeleted, setShowDeleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ url: string; alt: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = showDeleted ? '?showDeleted=true' : '';
      const res = await fetch(`/api/admin/drivers${qs}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load drivers');
      }
      setDrivers(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load drivers');
    } finally {
      setLoading(false);
    }
  }, [showDeleted]);

  useEffect(() => {
    load();
  }, [load]);

  const softDelete = useSoftDelete(load);

  if (loading) {
    return <div className="text-blue-800">Loading drivers...</div>;
  }

  if (error) {
    return <div className="text-red-600">{error}</div>;
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-blue-950">Drivers</h1>
          <p className="mt-1 text-gray-600">
            {drivers.length} {showDeleted ? 'deleted' : 'registered'} drivers
          </p>
        </div>
        <ShowDeletedToggle checked={showDeleted} onChange={setShowDeleted} />
      </div>

      {softDelete.error && <p className="mb-4 text-sm text-red-600">{softDelete.error}</p>}

      <div className="overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px]">
            <thead className="bg-blue-50">
              <tr>
                <th className="p-4 text-left text-sm font-semibold text-blue-950">Photo</th>
                <th className="p-4 text-left text-sm font-semibold text-blue-950">Name</th>
                <th className="p-4 text-left text-sm font-semibold text-blue-950">Email</th>
                <th className="p-4 text-left text-sm font-semibold text-blue-950">Phone</th>
                <th className="p-4 text-left text-sm font-semibold text-blue-950">Joined</th>
                <th className="p-4 text-left text-sm font-semibold text-blue-950">Actions</th>
              </tr>
            </thead>
            <tbody>
              {drivers.length > 0 ? (
                drivers.map((driver) => {
                  const name = formatAdminDriverName(driver);
                  return (
                    <tr key={driver.id} className="border-t border-blue-50 hover:bg-gray-50">
                      <td className="p-4">
                        {driver.photo_url ? (
                          <button
                            type="button"
                            onClick={() =>
                              setPreview({ url: driver.photo_url!, alt: `${name} profile photo` })
                            }
                            className="h-11 w-11 overflow-hidden rounded-full border border-blue-100 shadow-sm"
                            aria-label={`Preview photo for ${name}`}
                          >
                            <img
                              src={driver.photo_url}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          </button>
                        ) : (
                          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 text-lg text-gray-300">
                            👤
                          </div>
                        )}
                      </td>
                      <td className="p-4">
                        <Link
                          href={`/admin/drivers/${driver.id}`}
                          className="font-medium text-[#1E3A8A] hover:underline"
                        >
                          {name}
                        </Link>
                        {(driver.pendingDocuments ?? 0) > 0 && (
                          <span className="ml-2 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
                            {driver.pendingDocuments} doc pending
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-gray-600">{driver.email || '—'}</td>
                      <td className="p-4 text-gray-600">{driver.phone || '—'}</td>
                      <td className="p-4 text-sm text-gray-500">
                        {driver.created_at
                          ? new Date(driver.created_at).toLocaleDateString()
                          : '—'}
                      </td>
                      <td className="p-4">
                        <div className="flex flex-wrap items-center gap-3">
                          <Link
                            href={`/admin/drivers/${driver.id}`}
                            className="rounded-lg bg-[#1E3A8A] px-4 py-2 text-sm font-medium text-white hover:bg-[#162d6b]"
                          >
                            View Details
                          </Link>
                          <Link
                            href={`/admin/drivers/${driver.id}?tab=documents`}
                            className="text-sm font-medium text-[#1E3A8A] hover:underline"
                          >
                            Documents
                          </Link>
                          {!showDeleted && (
                            <button
                              type="button"
                              onClick={() =>
                                softDelete.requestDelete({
                                  entityType: 'profile',
                                  id: driver.id,
                                  label: name,
                                })
                              }
                              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-blue-700">
                    No drivers found yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <SoftDeleteConfirmModal
        open={Boolean(softDelete.pending)}
        title="Delete driver?"
        description="This driver will be deactivated and hidden from the marketplace. They will not be able to log in."
        entityLabel={softDelete.pending?.label ?? ''}
        loading={softDelete.loading}
        onConfirm={softDelete.confirmDelete}
        onCancel={softDelete.cancelDelete}
      />

      {preview && (
        <AdminImagePreviewModal
          imageUrl={preview.url}
          alt={preview.alt}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}