'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { DriverProfileRow } from '@/lib/driver-profile';
import ShowDeletedToggle from '@/components/admin/ShowDeletedToggle';
import SoftDeleteConfirmModal from '@/components/admin/SoftDeleteConfirmModal';
import { useSoftDelete } from '@/lib/admin/use-soft-delete';

export default function AdminDriversPage() {
  const [drivers, setDrivers] = useState<DriverProfileRow[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<DriverProfileRow | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const driverName = (driver: DriverProfileRow) => {
    const fromParts = [driver.first_name, driver.last_name].filter(Boolean).join(' ');
    return fromParts || driver.full_name || 'Unnamed';
  };

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

      <div className="bg-white border border-blue-100 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead className="bg-blue-50">
              <tr>
                <th className="text-left p-4 text-sm font-semibold text-blue-950">Name</th>
                <th className="text-left p-4 text-sm font-semibold text-blue-950">Email</th>
                <th className="text-left p-4 text-sm font-semibold text-blue-950">Phone</th>
                <th className="text-left p-4 text-sm font-semibold text-blue-950">Joined</th>
                <th className="text-left p-4 text-sm font-semibold text-blue-950">Actions</th>
              </tr>
            </thead>
            <tbody>
              {drivers.length > 0 ? (
                drivers.map((driver) => (
                  <tr key={driver.id} className="border-t border-blue-50 hover:bg-gray-50">
                    <td className="p-4 font-medium text-blue-950">{driverName(driver)}</td>
                    <td className="p-4 text-gray-600">{driver.email || '—'}</td>
                    <td className="p-4 text-gray-600">{driver.phone || '—'}</td>
                    <td className="p-4 text-sm text-gray-500">
                      {driver.created_at
                        ? new Date(driver.created_at).toLocaleDateString()
                        : '—'}
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          onClick={() => setSelectedDriver(driver)}
                          className="px-4 py-2 bg-[#1E3A8A] text-white text-sm rounded-lg hover:bg-[#162d6b]"
                        >
                          View Full Profile
                        </button>
                        <Link
                          href={`/admin/documents?driverId=${driver.id}`}
                          className="text-[#1E3A8A] hover:underline text-sm font-medium"
                        >
                          Review Documents
                        </Link>
                        {!showDeleted && (
                          <button
                            type="button"
                            onClick={() =>
                              softDelete.requestDelete({
                                entityType: 'profile',
                                id: driver.id,
                                label: driverName(driver),
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
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-blue-700">
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

      {selectedDriver && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-auto">
            <div className="sticky top-0 bg-white border-b p-6 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-blue-950">
                Full Profile — {driverName(selectedDriver)}
              </h2>
              <button
                onClick={() => setSelectedDriver(null)}
                className="text-3xl text-gray-400 hover:text-gray-600 leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8 text-sm text-blue-950">
              <div>
                <strong>Name:</strong> {selectedDriver.first_name} {selectedDriver.last_name}
              </div>
              <div>
                <strong>Email:</strong> {selectedDriver.email || '—'}
              </div>
              <div>
                <strong>Phone:</strong> {selectedDriver.phone || '—'}
                {selectedDriver.phone_type ? ` (${selectedDriver.phone_type})` : ''}
              </div>
              <div>
                <strong>Gender:</strong> {selectedDriver.gender || '—'}
              </div>

              <div className="md:col-span-2">
                <strong>Physical Address:</strong>
                <br />
                {selectedDriver.physical_address_line1 || '—'}
                <br />
                {selectedDriver.physical_address_line2 && (
                  <>
                    {selectedDriver.physical_address_line2}
                    <br />
                  </>
                )}
                {[selectedDriver.physical_city, selectedDriver.physical_state, selectedDriver.physical_postal_code]
                  .filter(Boolean)
                  .join(', ') || '—'}
              </div>

              <div className="md:col-span-2">
                <strong>Mailing Address:</strong>
                <br />
                {selectedDriver.mailing_same_as_physical !== false
                  ? 'Same as physical address'
                  : [
                      selectedDriver.mailing_address_line1,
                      selectedDriver.mailing_address_line2,
                      selectedDriver.mailing_city,
                      selectedDriver.mailing_state,
                      selectedDriver.mailing_postal_code,
                    ]
                      .filter(Boolean)
                      .join(', ') || '—'}
              </div>

              <div>
                <strong>Driver&apos;s License:</strong>{' '}
                {selectedDriver.drivers_license_number || '—'}
                {selectedDriver.drivers_license_state
                  ? ` (${selectedDriver.drivers_license_state})`
                  : ''}
              </div>
              <div>
                <strong>Expires:</strong>{' '}
                {selectedDriver.drivers_license_exp_month &&
                selectedDriver.drivers_license_exp_day &&
                selectedDriver.drivers_license_exp_year
                  ? `${selectedDriver.drivers_license_exp_month}/${selectedDriver.drivers_license_exp_day}/${selectedDriver.drivers_license_exp_year}`
                  : '—'}
              </div>

              <div>
                <strong>Date of Birth:</strong>{' '}
                {selectedDriver.dob_month && selectedDriver.dob_day && selectedDriver.dob_year
                  ? `${selectedDriver.dob_month}/${selectedDriver.dob_day}/${selectedDriver.dob_year}`
                  : '—'}
              </div>
              <div>
                <strong>SSN:</strong>{' '}
                {selectedDriver.ssn
                  ? `••••••${String(selectedDriver.ssn).slice(-4)}`
                  : 'Not provided'}
              </div>

              <div>
                <strong>Height:</strong>{' '}
                {selectedDriver.height_feet != null && selectedDriver.height_inches != null
                  ? `${selectedDriver.height_feet}' ${selectedDriver.height_inches}"`
                  : '—'}
              </div>
              <div>
                <strong>Weight:</strong>{' '}
                {selectedDriver.weight_lbs != null ? `${selectedDriver.weight_lbs} lbs` : '—'}
              </div>
              <div>
                <strong>Hair / Eye:</strong> {selectedDriver.hair_color || '—'} /{' '}
                {selectedDriver.eye_color || '—'}
              </div>

              <div className="md:col-span-2 border-t pt-6 mt-4">
                <strong>Emergency Contact:</strong>{' '}
                {selectedDriver.emergency_contact_first_name}{' '}
                {selectedDriver.emergency_contact_last_name}
                <br />
                Phone: {selectedDriver.emergency_contact_phone || '—'}
                {selectedDriver.emergency_contact_phone_type
                  ? ` (${selectedDriver.emergency_contact_phone_type})`
                  : ''}
                <br />
                Relation: {selectedDriver.emergency_contact_relation || '—'}
              </div>
            </div>

            <div className="p-6 border-t flex justify-end gap-3">
              <Link
                href={`/admin/documents?driverId=${selectedDriver.id}`}
                className="px-6 py-3 bg-[#1E3A8A] text-white rounded-xl hover:bg-[#162d6b]"
              >
                Review Documents
              </Link>
              <button
                onClick={() => setSelectedDriver(null)}
                className="px-8 py-3 bg-gray-200 rounded-xl hover:bg-gray-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}