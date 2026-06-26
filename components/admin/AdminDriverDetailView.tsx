'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import AdminImagePreviewModal from '@/components/admin/AdminImagePreviewModal';
import {
  formatAdminDate,
  formatAdminDateTime,
  formatAdminDriverName,
} from '@/components/admin/admin-driver-utils';
import type {
  AdminDriverAssignedTrip,
  AdminDriverDetail,
  AdminDriverDocument,
  AdminDriverOnboardingStatus,
} from '@/lib/admin/driver-detail';
import type {
  AdminComplianceItem,
  AdminComplianceItemStatus,
} from '@/lib/admin/driver-onboarding-status';
import { formatAdminTripPayout } from '@/lib/admin/driver-assigned-trips';
import { getDocumentDisplayLabel, sortDocumentsForReview } from '@/lib/driver/document-display';
import {
  profilePhotoStatusBadgeClass,
  profilePhotoStatusLabel,
  type ProfilePhotoStatus,
} from '@/lib/profile-photo';
import { formatStateList } from '@/lib/driver/us-states';

type AdminDriverDetailViewProps = {
  driverId: string;
  initialTab?: TabId;
};

type TabId = 'profile' | 'documents' | 'photo' | 'trips';

const TABS: { id: TabId; label: string }[] = [
  { id: 'profile', label: 'Profile Info' },
  { id: 'documents', label: 'Documents' },
  { id: 'photo', label: 'Profile Photo' },
  { id: 'trips', label: 'Assigned Trips' },
];

function tripStatusClass(status: string): string {
  if (status === 'completed') return 'bg-green-100 text-green-700';
  if (status === 'cancelled') return 'bg-gray-100 text-gray-600';
  if (status === 'in_progress') return 'bg-blue-100 text-blue-700';
  if (status === 'assigned') return 'bg-indigo-100 text-indigo-700';
  return 'bg-amber-100 text-amber-800';
}

function tripDetailHref(trip: AdminDriverAssignedTrip): string | null {
  if (trip.status === 'assigned' || trip.status === 'in_progress') {
    return `/admin/active-trips/${trip.id}`;
  }
  return null;
}

function documentStatusClass(status: string): string {
  if (status === 'approved') return 'bg-green-100 text-green-700';
  if (status === 'rejected') return 'bg-red-100 text-red-700';
  if (status === 'uploaded') return 'bg-gray-100 text-gray-700';
  return 'bg-yellow-100 text-yellow-700';
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 whitespace-pre-line text-sm text-blue-950">{value}</p>
    </div>
  );
}

function ProfileSection({
  title,
  children,
  className = '',
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`md:col-span-2 ${className}`}>
      <h2 className="mb-4 border-b border-blue-50 pb-2 text-sm font-semibold uppercase tracking-wide text-[#1E3A8A]">
        {title}
      </h2>
      {children}
    </section>
  );
}

function complianceStatusClass(status: AdminComplianceItemStatus): string {
  if (status === 'complete') return 'bg-green-100 text-green-700';
  if (status === 'pending') return 'bg-amber-100 text-amber-800';
  if (status === 'rejected') return 'bg-red-100 text-red-700';
  if (status === 'optional') return 'bg-slate-100 text-slate-600';
  return 'bg-gray-100 text-gray-700';
}

function complianceStatusLabel(status: AdminComplianceItemStatus): string {
  if (status === 'complete') return 'Complete';
  if (status === 'pending') return 'Pending';
  if (status === 'rejected') return 'Rejected';
  if (status === 'optional') return 'Optional';
  return 'Incomplete';
}

function accountStatusClass(tone: AdminDriverOnboardingStatus['accountStatusTone']): string {
  if (tone === 'green') return 'bg-green-100 text-green-800';
  if (tone === 'red') return 'bg-red-100 text-red-800';
  return 'bg-amber-100 text-amber-800';
}

function OnboardingProgressPanel({ status }: { status: AdminDriverOnboardingStatus }) {
  const completedCount = status.steps.filter((step) => step.complete).length;

  return (
    <ProfileSection title="Onboarding Progress">
      <div className="mb-5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <p className="text-2xl font-bold text-blue-950">{status.completionPercent}%</p>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${accountStatusClass(status.accountStatusTone)}`}
          >
            {status.accountStatusLabel}
          </span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-blue-50">
          <div
            className="h-full rounded-full bg-[#1E3A8A] transition-all"
            style={{ width: `${status.completionPercent}%` }}
          />
        </div>
        <p className="mt-2 text-sm text-blue-800">
          {completedCount} of {status.steps.length} onboarding steps complete
        </p>
      </div>

      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {status.steps.map((step) => (
          <li
            key={step.id}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
              step.complete
                ? 'border-green-100 bg-green-50 text-green-900'
                : 'border-amber-100 bg-amber-50 text-amber-900'
            }`}
          >
            <span aria-hidden className="text-base">
              {step.complete ? '✓' : '○'}
            </span>
            <span>
              <span className="font-medium">{step.title}</span>
              <span className="ml-1 text-xs opacity-80">
                {step.complete ? 'Complete' : 'Pending'}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </ProfileSection>
  );
}

function ComplianceStatusPanel({ items }: { items: AdminComplianceItem[] }) {
  return (
    <ProfileSection title="Compliance Status">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="rounded-xl border border-blue-50 bg-slate-50/60 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="font-medium text-blue-950">{item.label}</p>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${complianceStatusClass(item.status)}`}
              >
                {complianceStatusLabel(item.status)}
              </span>
            </div>
            <p className="mt-2 text-sm text-blue-800">{item.detail}</p>
          </div>
        ))}
      </div>
    </ProfileSection>
  );
}

export default function AdminDriverDetailView({
  driverId,
  initialTab = 'profile',
}: AdminDriverDetailViewProps) {
  const [detail, setDetail] = useState<AdminDriverDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewAlt, setPreviewAlt] = useState('Preview');
  const [processingDocId, setProcessingDocId] = useState<string | null>(null);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setError(null);

    const res = await fetch(`/api/admin/drivers/${driverId}`, { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setError(data.error || 'Failed to load driver');
      setDetail(null);
      setLoading(false);
      return;
    }

    setDetail(data as AdminDriverDetail);
    setLoading(false);
  }, [driverId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const sortedDocuments = useMemo(
    () => (detail ? sortDocumentsForReview(detail.documents) : []),
    [detail]
  );

  const updateDocumentStatus = async (
    docId: string,
    status: 'approved' | 'rejected',
    reason?: string
  ) => {
    setProcessingDocId(docId);
    const res = await fetch('/api/admin/documents/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ docId, status, rejectionReason: reason }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || 'Failed to update document status');
      setProcessingDocId(null);
      return;
    }

    await loadDetail();
    setProcessingDocId(null);
  };

  const openPreview = (url: string, alt: string) => {
    setPreviewUrl(url);
    setPreviewAlt(alt);
  };

  if (loading) {
    return <p className="text-blue-800">Loading driver…</p>;
  }

  if (error || !detail) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800">
        <p>{error || 'Driver not found'}</p>
        <Link href="/admin/drivers" className="mt-4 inline-block text-sm font-medium underline">
          Back to Drivers
        </Link>
      </div>
    );
  }

  const { driver, documents, photoAudit, assignedTrips, onboardingStatus } = detail;
  const driverName = formatAdminDriverName(driver);
  const photoStatus = (driver.profile_photo_status ?? null) as ProfilePhotoStatus | null;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/admin/drivers"
            className="text-sm font-medium text-[#1E3A8A] hover:underline"
          >
            ← Back to Drivers
          </Link>
          <h1 className="mt-2 text-3xl font-bold text-blue-950">{driverName}</h1>
          <p className="mt-1 text-blue-800">
            {driver.email || 'No email'} · Joined {formatAdminDate(driver.created_at)}
          </p>
        </div>
        {driver.photo_url && (
          <button
            type="button"
            onClick={() => openPreview(driver.photo_url!, `${driverName} profile photo`)}
            className="h-16 w-16 overflow-hidden rounded-full border-2 border-blue-100 shadow-sm"
          >
            <img
              src={driver.photo_url}
              alt=""
              className="h-full w-full object-cover"
            />
          </button>
        )}
      </div>

      <div className="mb-6 flex flex-wrap gap-2 border-b border-blue-100 pb-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-t-xl px-4 py-2.5 text-sm font-semibold transition ${
              activeTab === tab.id
                ? 'bg-[#1E3A8A] text-white'
                : 'bg-blue-50 text-blue-800 hover:bg-blue-100'
            }`}
          >
            {tab.label}
            {tab.id === 'documents' && (
              <span
                className={`ml-2 rounded-full px-2 py-0.5 text-xs ${
                  activeTab === tab.id ? 'bg-white/20' : 'bg-blue-100 text-blue-800'
                }`}
              >
                {documents.length}
              </span>
            )}
            {tab.id === 'trips' && (
              <span
                className={`ml-2 rounded-full px-2 py-0.5 text-xs ${
                  activeTab === tab.id ? 'bg-white/20' : 'bg-blue-100 text-blue-800'
                }`}
              >
                {assignedTrips.length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-blue-100 bg-white p-6 shadow-sm">
        {activeTab === 'profile' && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <OnboardingProgressPanel status={onboardingStatus} />
            <ComplianceStatusPanel items={onboardingStatus.complianceItems} />

            <ProfileSection title="Personal Information">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <ProfileField label="Name" value={driverName} />
                <ProfileField label="Email" value={driver.email || '—'} />
                <ProfileField
                  label="Phone"
                  value={
                    driver.phone
                      ? `${driver.phone}${driver.phone_type ? ` (${driver.phone_type})` : ''}`
                      : '—'
                  }
                />
                <ProfileField label="Gender" value={driver.gender || '—'} />
                <ProfileField
                  label="Operating States"
                  value={
                    Array.isArray(driver.driving_states) && driver.driving_states.length > 0
                      ? formatStateList(driver.driving_states)
                      : '—'
                  }
                />
                <ProfileField
                  label="Date of Birth"
                  value={
                    driver.dob_month && driver.dob_day && driver.dob_year
                      ? `${driver.dob_month}/${driver.dob_day}/${driver.dob_year}`
                      : '—'
                  }
                />
                <ProfileField
                  label="Height / Weight"
                  value={
                    driver.height_feet != null && driver.height_inches != null
                      ? `${driver.height_feet}' ${driver.height_inches}" · ${driver.weight_lbs ?? '—'} lbs`
                      : '—'
                  }
                />
                <ProfileField
                  label="Hair / Eyes"
                  value={`${driver.hair_color || '—'} / ${driver.eye_color || '—'}`}
                />
                <ProfileField
                  label="SSN"
                  value={
                    driver.ssn ? `••••••${String(driver.ssn).slice(-4)}` : 'Not provided'
                  }
                />
              </div>
            </ProfileSection>

            <ProfileSection title="Vehicle Information">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <ProfileField
                  label="Year / Make / Model"
                  value={
                    driver.vehicle_year && driver.vehicle_make && driver.vehicle_model
                      ? `${driver.vehicle_year} ${driver.vehicle_make} ${driver.vehicle_model}`
                      : '—'
                  }
                />
                <ProfileField
                  label="Passenger Capacity"
                  value={
                    driver.passenger_capacity != null ? String(driver.passenger_capacity) : '—'
                  }
                />
                <ProfileField
                  label="Seating Approval"
                  value={
                    driver.seating_approval_status
                      ? String(driver.seating_approval_status).replace(/_/g, ' ')
                      : 'approved'
                  }
                />
                {driver.seating_override_note && (
                  <div className="md:col-span-2">
                    <ProfileField
                      label="Seating Override Note"
                      value={driver.seating_override_note}
                    />
                  </div>
                )}
              </div>
            </ProfileSection>

            <ProfileSection title="Addresses">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <ProfileField
                  label="Physical Address"
                  value={
                    [
                      driver.physical_address_line1,
                      driver.physical_address_line2,
                      [driver.physical_city, driver.physical_state, driver.physical_postal_code]
                        .filter(Boolean)
                        .join(', '),
                    ]
                      .filter(Boolean)
                      .join('\n') || '—'
                  }
                />
                <ProfileField
                  label="Mailing Address"
                  value={
                    driver.mailing_same_as_physical !== false
                      ? 'Same as physical address'
                      : [
                          driver.mailing_address_line1,
                          driver.mailing_address_line2,
                          [driver.mailing_city, driver.mailing_state, driver.mailing_postal_code]
                            .filter(Boolean)
                            .join(', '),
                        ]
                          .filter(Boolean)
                          .join('\n') || '—'
                  }
                />
              </div>
            </ProfileSection>

            <ProfileSection title="Driver's License">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <ProfileField
                  label="License Number"
                  value={
                    driver.drivers_license_number
                      ? `${driver.drivers_license_number}${driver.drivers_license_state ? ` (${driver.drivers_license_state})` : ''}`
                      : '—'
                  }
                />
                <ProfileField
                  label="Expires"
                  value={
                    driver.drivers_license_exp_month &&
                    driver.drivers_license_exp_day &&
                    driver.drivers_license_exp_year
                      ? `${driver.drivers_license_exp_month}/${driver.drivers_license_exp_day}/${driver.drivers_license_exp_year}`
                      : '—'
                  }
                />
              </div>
            </ProfileSection>

            <ProfileSection title="Emergency Contact">
              <ProfileField
                label="Contact"
                value={[
                  [driver.emergency_contact_first_name, driver.emergency_contact_last_name]
                    .filter(Boolean)
                    .join(' ') || '—',
                  driver.emergency_contact_phone
                    ? `Phone: ${driver.emergency_contact_phone}${driver.emergency_contact_phone_type ? ` (${driver.emergency_contact_phone_type})` : ''}`
                    : null,
                  driver.emergency_contact_relation
                    ? `Relation: ${driver.emergency_contact_relation}`
                    : null,
                ]
                  .filter(Boolean)
                  .join('\n')}
              />
            </ProfileSection>
          </div>
        )}

        {activeTab === 'documents' && (
          <div>
            {sortedDocuments.length === 0 ? (
              <p className="text-blue-700">No documents uploaded yet.</p>
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {sortedDocuments.map((doc: AdminDriverDocument) => {
                  const isImage = /\.(jpg|jpeg|png|gif)$/i.test(doc.file_name);
                  const isPending =
                    doc.status === 'pending_review' || doc.status === 'uploaded';

                  return (
                    <div key={doc.id} className="rounded-xl border border-blue-50 p-4">
                      <div className="mb-3 flex items-start justify-between gap-2">
                        <p className="font-medium text-blue-950">
                          {getDocumentDisplayLabel(doc.document_type)}
                        </p>
                        <span
                          className={`shrink-0 rounded-full px-2 py-1 text-xs capitalize ${documentStatusClass(doc.status)}`}
                        >
                          {doc.status.replace(/_/g, ' ')}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => window.open(doc.file_url, '_blank')}
                        className="mb-3 block w-full"
                      >
                        {isImage ? (
                          <img
                            src={doc.file_url}
                            alt=""
                            className="h-40 w-full rounded-lg object-cover"
                          />
                        ) : (
                          <div className="flex h-40 items-center justify-center rounded-lg bg-gray-100 text-5xl">
                            📄
                          </div>
                        )}
                      </button>

                      <p className="text-sm text-blue-800">
                        Uploaded: {formatAdminDate(doc.uploaded_at)}
                      </p>
                      <p className="text-sm text-blue-800">
                        Expires: {formatAdminDate(doc.expires_at) || 'Not provided'}
                      </p>
                      {doc.rejection_reason && (
                        <p className="mt-2 text-xs text-red-700">
                          Rejected: {doc.rejection_reason}
                        </p>
                      )}

                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => window.open(doc.file_url, '_blank')}
                          className="rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-medium text-blue-950 hover:bg-blue-50"
                        >
                          Open / Download
                        </button>
                        {isPending && (
                          <>
                            <button
                              type="button"
                              disabled={processingDocId === doc.id}
                              onClick={() => updateDocumentStatus(doc.id, 'approved')}
                              className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              disabled={processingDocId === doc.id}
                              onClick={() => {
                                const reason = prompt('Rejection reason:');
                                if (reason?.trim()) {
                                  void updateDocumentStatus(doc.id, 'rejected', reason.trim());
                                }
                              }}
                              className="rounded-lg bg-red-100 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-200 disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'photo' && (
          <div className="max-w-xl">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              {photoStatus && (
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-medium ${profilePhotoStatusBadgeClass(photoStatus)}`}
                >
                  {profilePhotoStatusLabel(photoStatus)}
                </span>
              )}
              {driver.profile_photo_last_reviewed_at && (
                <span className="text-sm text-blue-700">
                  Last reviewed {formatAdminDateTime(driver.profile_photo_last_reviewed_at)}
                </span>
              )}
            </div>

            {driver.photo_url ? (
              <button
                type="button"
                onClick={() => openPreview(driver.photo_url!, `${driverName} profile photo`)}
                className="mb-4 block"
              >
                <img
                  src={driver.photo_url}
                  alt={`Profile photo for ${driverName}`}
                  className="h-56 w-56 rounded-full border-4 border-blue-100 object-cover shadow-md"
                />
              </button>
            ) : (
              <div className="mb-4 flex h-56 w-56 items-center justify-center rounded-full bg-gray-100 text-5xl text-gray-300">
                👤
              </div>
            )}

            {driver.profile_photo_rejection_reason && (
              <p className="mb-4 rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-800">
                <strong>Rejection reason:</strong> {driver.profile_photo_rejection_reason}
              </p>
            )}

            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <p className="mb-3 text-sm font-semibold text-slate-900">Review history</p>
              {photoAudit.length === 0 ? (
                <p className="text-sm text-slate-600">No review actions recorded yet.</p>
              ) : (
                <ul className="space-y-3">
                  {photoAudit.map((entry) => (
                    <li key={entry.id} className="text-sm text-slate-700">
                      <span className="font-medium capitalize">{entry.action}</span> by{' '}
                      {entry.admin_name || 'Admin'} on {formatAdminDateTime(entry.created_at)}
                      {entry.rejection_reason && (
                        <p className="mt-1 text-red-700">{entry.rejection_reason}</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <Link
              href="/admin/profile-photos"
              className="mt-4 inline-block text-sm font-medium text-[#1E3A8A] hover:underline"
            >
              Open Profile Photo Review queue →
            </Link>
          </div>
        )}

        {activeTab === 'trips' && (
          <div>
            {assignedTrips.length === 0 ? (
              <p className="text-blue-700">No trips have been assigned to this driver yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-sm">
                  <thead>
                    <tr className="border-b border-blue-100 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      <th className="pb-3 pr-4">Trip</th>
                      <th className="pb-3 pr-4">Pickup</th>
                      <th className="pb-3 pr-4">Route</th>
                      <th className="pb-3 pr-4">Status</th>
                      <th className="pb-3 pr-4">Payout</th>
                      <th className="pb-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignedTrips.map((trip) => {
                      const detailHref = tripDetailHref(trip);
                      return (
                        <tr key={trip.id} className="border-b border-blue-50 align-top">
                          <td className="py-4 pr-4">
                            <p className="font-medium text-blue-950">{trip.title}</p>
                            <p className="mt-1 text-xs text-gray-500">{trip.organization_name}</p>
                          </td>
                          <td className="py-4 pr-4 whitespace-nowrap text-blue-950">
                            {formatAdminDateTime(trip.pickup_time)}
                          </td>
                          <td className="py-4 pr-4">
                            <p className="text-blue-950">
                              {trip.pickup_area} → {trip.dropoff_area}
                            </p>
                            <p className="mt-1 text-xs text-gray-500">
                              {trip.pickup_location} → {trip.dropoff_location}
                            </p>
                          </td>
                          <td className="py-4 pr-4">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium capitalize ${tripStatusClass(trip.status)}`}
                            >
                              {trip.status.replace(/_/g, ' ')}
                            </span>
                            {trip.driver_payout_status && (
                              <p className="mt-1 text-xs capitalize text-gray-500">
                                Payout: {trip.driver_payout_status.replace(/_/g, ' ')}
                              </p>
                            )}
                          </td>
                          <td className="py-4 pr-4 font-medium text-blue-950">
                            {formatAdminTripPayout(trip.payout_amount)}
                          </td>
                          <td className="py-4">
                            {detailHref ? (
                              <Link
                                href={detailHref}
                                className="text-sm font-medium text-[#1E3A8A] hover:underline"
                              >
                                View live trip
                              </Link>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {previewUrl && (
        <AdminImagePreviewModal
          imageUrl={previewUrl}
          alt={previewAlt}
          onClose={() => setPreviewUrl(null)}
        />
      )}
    </div>
  );
}