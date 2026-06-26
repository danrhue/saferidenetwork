'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';

interface Driver {
  id: string;
  full_name: string | null;
  role: string | null;
  phone: string | null;
  created_at: string;
  pendingDocuments?: number;
}

const PENDING_DOC_STATUSES = new Set(['uploaded', 'pending_review']);

interface DriverDocument {
  id: string;
  document_type: string;
  file_url: string;
  file_name: string;
  uploaded_at: string;
  expires_at?: string;
  status: string;
  rejection_reason?: string;
}

export default function DocumentReviewPage() {
  const searchParams = useSearchParams();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [documents, setDocuments] = useState<DriverDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [driversError, setDriversError] = useState<string | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectingDocId, setRejectingDocId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const totalPendingDocuments = drivers.reduce(
    (sum, driver) => sum + (driver.pendingDocuments ?? 0),
    0
  );

  const adjustDriverPendingCount = (driverId: string, delta: number) => {
    setDrivers((prev) =>
      prev
        .map((driver) =>
          driver.id === driverId
            ? {
                ...driver,
                pendingDocuments: Math.max(0, (driver.pendingDocuments ?? 0) + delta),
              }
            : driver
        )
        .sort((a, b) => {
          if ((b.pendingDocuments ?? 0) !== (a.pendingDocuments ?? 0)) {
            return (b.pendingDocuments ?? 0) - (a.pendingDocuments ?? 0);
          }
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        })
    );
  };

  const loadDriverDocuments = useCallback(async (driver: Driver) => {
    setSelectedDriver(driver);
    setLoading(true);
    const res = await fetch(`/api/admin/driver-documents?driverId=${driver.id}`, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        setDocuments(data);
      } else {
        if (data.driver) {
          setSelectedDriver(data.driver);
        }
        setDocuments(Array.isArray(data.documents) ? data.documents : []);
      }
    } else {
      setDocuments([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const fetchDrivers = async () => {
      const res = await fetch('/api/admin/drivers', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        setDrivers(list);
        setDriversError(null);

        const driverId = searchParams.get('driverId');
        if (driverId) {
          const match = list.find((d) => d.id === driverId);
          if (match) {
            await loadDriverDocuments(match);
          }
        }
      } else {
        const err = await res.json().catch(() => ({}));
        setDriversError(err.error || 'Failed to load drivers');
      }
    };

    fetchDrivers();
  }, [searchParams, loadDriverDocuments]);

  const updateDocumentStatus = async (docId: string, newStatus: 'approved' | 'rejected', reason?: string) => {
    const res = await fetch('/api/admin/documents/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ docId, status: newStatus, rejectionReason: reason }),
    });

    if (res.ok) {
      const previousDoc = documents.find((d) => d.id === docId);
      const wasPending = previousDoc ? PENDING_DOC_STATUSES.has(previousDoc.status) : false;
      const clearsPending =
        wasPending && (newStatus === 'approved' || newStatus === 'rejected');

      setDocuments((prev) =>
        prev.map((d) =>
          d.id === docId
            ? {
                ...d,
                status: newStatus,
                rejection_reason: newStatus === 'rejected' ? reason : undefined,
              }
            : d
        )
      );

      if (clearsPending && selectedDriver) {
        adjustDriverPendingCount(selectedDriver.id, -1);
      }
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.error || 'Failed to update status');
    }
  };

  const handleReject = (docId: string) => {
    setRejectingDocId(docId);
    setRejectionReason('');
    setShowRejectModal(true);
  };

  const getStatusColor = (status: string) => {
    if (status === 'approved') return 'bg-green-100 text-green-700';
    if (status === 'rejected') return 'bg-red-100 text-red-700';
    if (status === 'uploaded') return 'bg-gray-100 text-gray-700';
    return 'bg-yellow-100 text-yellow-700';
  };

  const formatDate = (value?: string) => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString();
  };

  const confirmReject = () => {
    if (rejectingDocId && rejectionReason.trim()) {
      updateDocumentStatus(rejectingDocId, 'rejected', rejectionReason.trim());
      setShowRejectModal(false);
      setRejectingDocId(null);
      setRejectionReason('');
    } else {
      alert('Please provide a reason for rejection');
    }
  };

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-blue-950 mb-2">Document Review</h1>
          <p className="text-blue-800">
            Approve or reject driver-submitted documents.
          </p>
        </div>

        {totalPendingDocuments > 0 && (
          <div className="bg-orange-100 text-orange-700 px-6 py-3 rounded-2xl flex items-center gap-3 font-medium shadow-sm border border-orange-200 shrink-0">
            <span className="text-2xl" aria-hidden>
              ⏳
            </span>
            <div>
              <div className="text-2xl font-bold leading-none">{totalPendingDocuments}</div>
              <div className="text-xs mt-0.5">Pending Review</div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 border border-blue-100 rounded-2xl p-6 bg-white shadow-sm">
          <h2 className="font-semibold text-blue-950 mb-4 flex items-center justify-between">
            Drivers <span className="text-sm font-normal text-blue-700">({drivers.length})</span>
          </h2>

          {driversError && (
            <p className="text-red-600 text-sm mb-3">{driversError}</p>
          )}

          {drivers.length === 0 ? (
            <p className="text-blue-700 text-sm">
              No drivers found. Make sure drivers have <code className="text-xs">role = &apos;driver&apos;</code> in profiles.
            </p>
          ) : (
            <div className="space-y-2 max-h-[65vh] overflow-auto">
              {drivers.map((driver) => {
                const pending = driver.pendingDocuments ?? 0;
                return (
                  <button
                    key={driver.id}
                    onClick={() => loadDriverDocuments(driver)}
                    className={`w-full text-left p-4 rounded-xl transition-all border flex justify-between items-center gap-3 ${
                      selectedDriver?.id === driver.id
                        ? 'bg-blue-50 border-blue-200'
                        : 'hover:bg-gray-50 border-transparent'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-blue-950">
                        {driver.full_name || 'Unnamed Driver'}
                      </div>
                      <div className="text-xs text-blue-700">
                        Joined {new Date(driver.created_at).toLocaleDateString()}
                        {driver.phone ? ` · ${driver.phone}` : ''}
                      </div>
                    </div>
                    {pending > 0 && (
                      <span className="shrink-0 px-3 py-1 text-xs font-semibold bg-orange-100 text-orange-700 rounded-full">
                        {pending} pending
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="lg:col-span-2 border border-blue-100 rounded-2xl p-6 bg-white min-h-[400px] shadow-sm">
          {selectedDriver ? (
            <>
              <h2 className="font-semibold text-xl text-blue-950 mb-2">
                Documents for:{' '}
                <span className="text-[#1E3A8A]">{selectedDriver.full_name || 'Unnamed Driver'}</span>
              </h2>
              <p className="text-sm text-blue-700 mb-6">
                Joined {formatDate(selectedDriver.created_at) || '—'}
                {selectedDriver.phone ? ` · ${selectedDriver.phone}` : ''}
              </p>

              {loading ? (
                <p className="text-blue-800">Loading documents...</p>
              ) : documents.length === 0 ? (
                <p className="text-blue-700">This driver has not uploaded any documents yet.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {documents.map((doc) => (
                    <div key={doc.id} className="border border-blue-50 rounded-xl p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div className="font-medium capitalize text-blue-950">{doc.document_type.replace(/_/g, ' ')}</div>
                        <span className={`text-xs px-2 py-1 rounded-full capitalize ${getStatusColor(doc.status)}`}>
                          {doc.status.replace(/_/g, ' ')}
                        </span>
                      </div>

                      <div onClick={() => window.open(doc.file_url, '_blank')} className="cursor-pointer mb-3">
                        {/\.(jpg|jpeg|png)$/i.test(doc.file_name) ? (
                          <img src={doc.file_url} alt="" className="w-full h-48 object-cover rounded-lg" />
                        ) : (
                          <div className="h-48 bg-gray-100 rounded-lg flex items-center justify-center text-6xl">📄</div>
                        )}
                      </div>

                      <p className="text-sm text-blue-800 mb-1">
                        Uploaded: <span className="font-medium">{formatDate(doc.uploaded_at) || '—'}</span>
                      </p>
                      <p className="text-sm text-blue-800 mb-3">
                        Expires:{' '}
                        <span className={`font-medium ${doc.expires_at ? 'text-blue-950' : 'text-blue-600'}`}>
                          {formatDate(doc.expires_at) || 'Not provided'}
                        </span>
                      </p>
                      {doc.rejection_reason && (
                        <p className="text-xs text-red-600 mt-1">Rejected: {doc.rejection_reason}</p>
                      )}

                      <div className="flex gap-3 mt-4">
                        <button
                          onClick={() => updateDocumentStatus(doc.id, 'approved')}
                          className={`flex-1 py-2 rounded-lg text-sm font-medium ${doc.status === 'approved' ? 'bg-green-600 text-white' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleReject(doc.id)}
                          className={`flex-1 py-2 rounded-lg text-sm font-medium ${doc.status === 'rejected' ? 'bg-red-600 text-white' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="h-full min-h-[300px] flex items-center justify-center text-blue-600">
              Select a driver from the left to review their documents
            </div>
          )}
        </div>
      </div>

      {showRejectModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl">
            <h3 className="font-semibold text-xl mb-4 text-[#1E3A8A]">Reject Document</h3>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Enter reason for rejection (e.g. Expired document, Poor quality scan, Missing information...)"
              className="w-full h-36 border border-gray-300 rounded-xl p-4 text-base text-blue-950 placeholder:text-blue-600 focus:border-[#1E3A8A] focus:ring-2 focus:ring-[#1E3A8A]/20 resize-y outline-none"
            />
            <div className="flex gap-3 mt-8">
              <button
                onClick={() => { setShowRejectModal(false); setRejectingDocId(null); setRejectionReason(''); }}
                className="flex-1 py-3 border border-gray-300 rounded-xl hover:bg-gray-50 font-medium text-blue-950"
              >
                Cancel
              </button>
              <button
                onClick={confirmReject}
                disabled={!rejectionReason.trim()}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors"
              >
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}