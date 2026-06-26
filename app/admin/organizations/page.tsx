'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AdminOrganizationRow } from '@/lib/driver-profile';
import ShowDeletedToggle from '@/components/admin/ShowDeletedToggle';
import SoftDeleteConfirmModal from '@/components/admin/SoftDeleteConfirmModal';
import { useSoftDelete } from '@/lib/admin/use-soft-delete';
import AdminPageHeader from '@/components/admin/AdminPageHeader';

export default function AdminOrganizationsPage() {
  const [organizations, setOrganizations] = useState<AdminOrganizationRow[]>([]);
  const [showDeleted, setShowDeleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = showDeleted ? '?showDeleted=true' : '';
      const res = await fetch(`/api/admin/organizations${qs}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load organizations');
      setOrganizations(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load organizations');
    } finally {
      setLoading(false);
    }
  }, [showDeleted]);

  useEffect(() => {
    load();
  }, [load]);

  const softDelete = useSoftDelete(load);

  const orgLabel = (org: AdminOrganizationRow) =>
    org.organization_name || org.full_name || org.email || org.id;

  if (loading) {
    return <div className="text-blue-800">Loading organizations...</div>;
  }

  return (
    <div>
      <AdminPageHeader
        title="Organizations"
        subtitle={showDeleted ? 'Soft-deleted organization accounts' : 'Active organization accounts'}
      />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <p className="text-gray-600">{organizations.length} organization(s)</p>
        <ShowDeletedToggle checked={showDeleted} onChange={setShowDeleted} />
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {softDelete.error && <p className="mb-4 text-sm text-red-600">{softDelete.error}</p>}

      <div className="overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead className="bg-blue-50">
              <tr>
                <th className="p-4 text-left text-sm font-semibold text-blue-950">Organization</th>
                <th className="p-4 text-left text-sm font-semibold text-blue-950">Contact</th>
                <th className="p-4 text-left text-sm font-semibold text-blue-950">Joined</th>
                <th className="p-4 text-left text-sm font-semibold text-blue-950">Actions</th>
              </tr>
            </thead>
            <tbody>
              {organizations.length > 0 ? (
                organizations.map((org) => (
                  <tr key={org.id} className="border-t border-blue-50 hover:bg-gray-50">
                    <td className="p-4 font-medium text-blue-950">{orgLabel(org)}</td>
                    <td className="p-4 text-gray-600">{org.email || org.phone || '—'}</td>
                    <td className="p-4 text-sm text-gray-500">
                      {org.created_at ? new Date(org.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="p-4">
                      {!showDeleted && (
                        <button
                          type="button"
                          onClick={() =>
                            softDelete.requestDelete({
                              entityType: 'profile',
                              id: org.id,
                              label: orgLabel(org),
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
                  <td colSpan={4} className="p-8 text-center text-blue-700">
                    No organizations found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <SoftDeleteConfirmModal
        open={Boolean(softDelete.pending)}
        title="Delete organization?"
        description="This organization will be deactivated and hidden from the platform. Users will not be able to log in."
        entityLabel={softDelete.pending?.label ?? ''}
        loading={softDelete.loading}
        onConfirm={softDelete.confirmDelete}
        onCancel={softDelete.cancelDelete}
      />
    </div>
  );
}