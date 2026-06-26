'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AdminTripRow, DeletedProfileRow } from '@/lib/driver-profile';
import type { SoftDeleteAuditEntry } from '@/lib/soft-delete';
import { useSoftDelete } from '@/lib/admin/use-soft-delete';
import AdminPageHeader from '@/components/admin/AdminPageHeader';

type DeletedItemsResponse = {
  profiles: DeletedProfileRow[];
  trips: AdminTripRow[];
  auditLog: SoftDeleteAuditEntry[];
};

export default function AdminDeletedItemsPage() {
  const [data, setData] = useState<DeletedItemsResponse>({ profiles: [], trips: [], auditLog: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/deleted-items', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load deleted items');
      setData({
        profiles: json.profiles ?? [],
        trips: json.trips ?? [],
        auditLog: json.auditLog ?? [],
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load deleted items');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const softDelete = useSoftDelete(load);

  const profileLabel = (p: DeletedProfileRow) => {
    if (p.role === 'organization') {
      return p.organization_name || p.full_name || p.email || p.auth_email || p.id;
    }
    const name = [p.first_name, p.last_name].filter(Boolean).join(' ');
    return name || p.full_name || p.email || p.auth_email || p.id;
  };

  const profileEmail = (p: DeletedProfileRow) => p.email || p.auth_email || null;

  if (loading) {
    return <div className="text-blue-800">Loading deleted items...</div>;
  }

  return (
    <div>
      <AdminPageHeader
        title="Deleted Items"
        subtitle="Review soft-deleted accounts and trips. Restore items to return them to the platform."
      />

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {softDelete.error && <p className="mb-4 text-sm text-red-600">{softDelete.error}</p>}

      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-blue-950">
            Deleted Accounts ({data.profiles.length})
          </h2>
          {data.profiles.length === 0 ? (
            <p className="text-sm text-gray-500">No deleted profiles.</p>
          ) : (
            <ul className="space-y-3">
              {data.profiles.map((profile) => (
                <li
                  key={profile.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-100 bg-red-50/40 px-4 py-3"
                >
                  <div>
                    <p className="font-medium text-blue-950">{profileLabel(profile)}</p>
                    <p className="text-xs text-gray-500">
                      {profileEmail(profile) && (
                        <span className="block">{profileEmail(profile)}</span>
                      )}
                      <span className="capitalize">{profile.role || 'profile'}</span>
                      {profile.deleted_at
                        ? ` • deleted ${new Date(profile.deleted_at).toLocaleString()}`
                        : ''}
                      {profile.deleted_by_email
                        ? ` • by ${profile.deleted_by_email}`
                        : profile.deleted_by
                          ? ` • by ${profile.deleted_by.slice(0, 8)}…`
                          : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={softDelete.loading}
                    onClick={() => softDelete.restore('profile', profile.id)}
                    className="rounded-lg bg-[#1E3A8A] px-4 py-2 text-sm font-medium text-white hover:bg-[#162d6b] disabled:opacity-60"
                  >
                    Restore
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-blue-950">
            Deleted Trips ({data.trips.length})
          </h2>
          {data.trips.length === 0 ? (
            <p className="text-sm text-gray-500">No deleted trips.</p>
          ) : (
            <ul className="space-y-3">
              {data.trips.map((trip) => (
                <li
                  key={trip.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-100 bg-red-50/40 px-4 py-3"
                >
                  <div>
                    <p className="font-medium text-blue-950">{trip.title}</p>
                    <p className="text-xs text-gray-500">
                      {trip.status}
                      {trip.deleted_at
                        ? ` • deleted ${new Date(trip.deleted_at).toLocaleString()}`
                        : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={softDelete.loading}
                    onClick={() => softDelete.restore('trip', trip.id)}
                    className="rounded-lg bg-[#1E3A8A] px-4 py-2 text-sm font-medium text-white hover:bg-[#162d6b] disabled:opacity-60"
                  >
                    Restore
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-blue-950">Recent Audit Log</h2>
        {data.auditLog.length === 0 ? (
          <p className="text-sm text-gray-500">No audit entries yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b text-left text-blue-900">
                  <th className="pb-2 pr-4">When</th>
                  <th className="pb-2 pr-4">Action</th>
                  <th className="pb-2 pr-4">Entity</th>
                  <th className="pb-2">ID</th>
                </tr>
              </thead>
              <tbody>
                {data.auditLog.map((entry) => (
                  <tr key={entry.id} className="border-b border-blue-50">
                    <td className="py-2 pr-4 text-gray-600">
                      {new Date(entry.performed_at).toLocaleString()}
                    </td>
                    <td className="py-2 pr-4 capitalize">{entry.action.replace('_', ' ')}</td>
                    <td className="py-2 pr-4 capitalize">{entry.entity_type}</td>
                    <td className="py-2 font-mono text-xs text-gray-500">{entry.entity_id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}