'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  findDriverDocument,
  formatDocumentValidity,
} from '@/lib/driver/required-documents';
import { isDocumentExpired } from '@/lib/driver/document-expiration';
import { toDateInputValue } from '@/lib/driver/document-dates';
import { useRequiredDriverDocuments } from '@/lib/driver/useRequiredDriverDocuments';
import { formatStateList } from '@/lib/driver/us-states';
import { uploadDriverDocument } from '@/app/actions/driver-documents';

interface Document {
  id: string;
  document_type: string;
  file_url: string;
  file_name: string;
  uploaded_at: string;
  expires_at?: string;
  status: string;
  rejection_reason?: string;
}

export default function DriverDocumentsPage() {
  const {
    loading: requirementsLoading,
    documents: requiredDocuments,
    drivingStates,
    message: requirementsMessage,
  } = useRequiredDriverDocuments();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [uploading, setUploading] = useState<string | null>(null);
  const [savingDate, setSavingDate] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [expiryDates, setExpiryDates] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchDocuments();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !documents.length) return;
    const hash = window.location.hash.replace('#', '');
    if (!hash.startsWith('doc-')) return;
    const target = document.getElementById(hash);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [documents]);

  const syncExpiryDatesFromDocuments = (docs: Document[]) => {
    const synced: Record<string, string> = {};
    requiredDocuments.forEach((req) => {
      if (!req.requiresExpiration && !req.validityYears) return;
      const existing = findDriverDocument(docs, req.type);
      if (existing?.expires_at) {
        synced[req.type] = toDateInputValue(existing.expires_at);
      }
    });
    setExpiryDates((prev) => ({ ...prev, ...synced }));
  };

  const fetchDocuments = async () => {
    const res = await fetch('/api/driver/documents', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setDocuments(list);
      syncExpiryDatesFromDocuments(list);
    }
  };

  const resolveExpiryForUpload = (documentType: string, existing?: Document) => {
    if (expiryDates[documentType]) {
      return expiryDates[documentType];
    }
    if (existing?.expires_at) {
      return toDateInputValue(existing.expires_at);
    }
    return undefined;
  };

  const saveExpirationDate = async (documentType: string) => {
    const date = expiryDates[documentType];
    if (!date) return;

    if (new Date(`${date}T23:59:59Z`).getTime() <= Date.now()) {
      alert('Expiration date must be in the future.');
      return;
    }

    setSavingDate(documentType);

    try {
      const res = await fetch('/api/driver/update-expiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentType, expiresAt: date }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        await fetchDocuments();
        alert('Expiration date saved successfully!');
      } else {
        alert(data.error || 'Failed to save expiration date.');
      }
    } catch {
      alert('Error saving expiration date.');
    } finally {
      setSavingDate(null);
    }
  };

  const handleUpload = async (documentType: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const docDef = requiredDocuments.find((d) => d.type === documentType);
    const existing = findDriverDocument(documents, documentType);
    const expiry = resolveExpiryForUpload(documentType, existing);

    if (docDef?.requiresExpiration && !expiry) {
      alert('Please enter an expiration date before uploading this document.');
      e.target.value = '';
      return;
    }

    if (expiry && new Date(`${expiry}T23:59:59Z`).getTime() <= Date.now()) {
      alert('Expiration date must be in the future.');
      e.target.value = '';
      return;
    }

    setUploading(documentType);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('documentType', documentType);
    if (expiry) formData.append('expiresAt', expiry);

    try {
      const result = await uploadDriverDocument(formData);
      if (result.success) {
        await fetchDocuments();
      }
    } catch (error: unknown) {
      console.error('Upload error:', error);
      const message = error instanceof Error ? error.message : 'Unknown error.';
      alert('Upload failed: ' + message);
    } finally {
      setUploading(null);
      e.target.value = '';
    }
  };

  const approvedTypes = new Set(
    documents.filter((d) => d.status === 'approved').map((d) => d.document_type)
  );
  const uploadedTypes = new Set(documents.map((d) => d.document_type));
  const totalRequired = requiredDocuments.length;
  const approvedCount = approvedTypes.size;
  const uploadedCount = uploadedTypes.size;
  const progress =
    totalRequired > 0 ? Math.round((approvedCount / totalRequired) * 100) : 0;

  const getStatusBadge = (doc: Document) => {
    if (isDocumentExpired(doc.expires_at) && doc.status !== 'rejected') {
      return (
        <span className="px-3 py-1 text-xs font-medium bg-red-100 text-red-700 rounded-full">
          Expired
        </span>
      );
    }

    switch (doc.status) {
      case 'approved':
        return <span className="px-3 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">Approved</span>;
      case 'rejected':
        return <span className="px-3 py-1 text-xs font-medium bg-red-100 text-red-700 rounded-full">Rejected</span>;
      case 'pending_review':
        return <span className="px-3 py-1 text-xs font-medium bg-yellow-100 text-yellow-700 rounded-full">Pending Review</span>;
      default:
        return <span className="px-3 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">Uploaded</span>;
    }
  };

  const getFilePreview = (doc: Document) => {
    const isImage = /\.(jpg|jpeg|png|gif)$/i.test(doc.file_name);
    return isImage ? (
      <img
        src={doc.file_url}
        alt={doc.file_name}
        className="w-full h-40 object-cover rounded-lg cursor-pointer hover:opacity-90"
        onClick={() => setPreviewUrl(doc.file_url)}
      />
    ) : (
      <div
        className="w-full h-40 bg-gray-100 rounded-lg flex items-center justify-center cursor-pointer"
        onClick={() => window.open(doc.file_url, '_blank')}
      >
        <div className="text-center">
          <div className="text-5xl">📄</div>
          <div className="text-xs text-gray-500 mt-2 px-2 break-all">{doc.file_name}</div>
        </div>
      </div>
    );
  };

  if (requirementsLoading) {
    return <div className="max-w-5xl mx-auto p-8 text-blue-950">Loading document requirements...</div>;
  }

  return (
    <div className="max-w-5xl mx-auto">
      {drivingStates.length === 0 ? (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <p className="font-medium text-amber-900">Select your operating states first</p>
          <p className="mt-1 text-sm text-amber-800">
            {requirementsMessage ||
              'Choose the states where you plan to drive so we can show the correct required documents.'}
          </p>
          <Link
            href="/dashboard/profile?step=2"
            className="mt-3 inline-block rounded-xl bg-[#1E3A8A] px-5 py-2 text-sm font-semibold text-white hover:bg-[#162D6B]"
          >
            Set Operating States
          </Link>
        </div>
      ) : (
        <p className="mb-6 text-sm text-blue-800">
          Requirements for: <span className="font-semibold">{formatStateList(drivingStates)}</span>
        </p>
      )}

      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">My Documents</h1>
          <p className="text-gray-600">
            Upload required documents to activate your account. PDF, JPG, PNG (max 10MB)
          </p>
        </div>
        <div className="text-right">
          <div className="text-4xl font-bold text-[#1E3A8A]">{progress}%</div>
          <div className="text-sm text-gray-500">
            {approvedCount} of {totalRequired} approved
          </div>
          <div className="text-xs text-gray-400 mt-1">
            {uploadedCount} uploaded
          </div>
        </div>
      </div>

      <div className="h-3 bg-gray-100 rounded-full mb-10 overflow-hidden">
        <div
          className="h-3 bg-green-600 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {requiredDocuments.map((doc) => {
          const existing = findDriverDocument(documents, doc.type);
          const isUploading = uploading === doc.type;
          const isSaving = savingDate === doc.type;
          const showExpiration = doc.requiresExpiration === true || !!doc.validityYears;
          const expiryValue =
            expiryDates[doc.type] ||
            (existing?.expires_at ? toDateInputValue(existing.expires_at) : '');
          const canSaveExpiry = !!expiryValue && !!existing;

          return (
            <div
              id={`doc-${doc.type}`}
              key={doc.type}
              className="border border-gray-200 rounded-2xl p-6 bg-white hover:border-[#1E3A8A] transition-all scroll-mt-24"
            >
              <div className="flex justify-between items-start mb-4">
                <h3 className="font-semibold text-lg">{doc.label}</h3>
                {existing && getStatusBadge(existing)}
              </div>

              <div className="text-sm space-y-1.5 text-gray-600 mb-4">
                <div>Cost: <span className={doc.cost.includes('Driver') ? 'text-orange-600' : 'text-green-600'}>{doc.cost}</span></div>
                {formatDocumentValidity(doc) && <div>{formatDocumentValidity(doc)}</div>}
                {doc.description && <p className="text-sm leading-relaxed text-gray-700">{doc.description}</p>}
                {doc.specialNote && <div className="text-xs italic">{doc.specialNote}</div>}
              </div>

              {showExpiration && (
                <div className="mb-4 p-4 border rounded-xl bg-gray-50">
                  <label className="block text-sm font-medium mb-2">
                    Expiration Date{doc.requiresExpiration ? ' *' : ''}
                  </label>
                  <div className="flex gap-3">
                    <input
                      type="date"
                      required={doc.requiresExpiration}
                      min={new Date().toISOString().split('T')[0]}
                      value={expiryValue}
                      onChange={(e) =>
                        setExpiryDates((prev) => ({ ...prev, [doc.type]: e.target.value }))
                      }
                      className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => saveExpirationDate(doc.type)}
                      disabled={isSaving || !canSaveExpiry}
                      className="px-6 py-2 bg-[#1E3A8A] text-white rounded-lg hover:bg-[#162d6b] disabled:opacity-50 text-sm font-medium whitespace-nowrap"
                    >
                      {isSaving ? 'Saving...' : 'Save Date'}
                    </button>
                  </div>
                  {formatDocumentValidity(doc) && (
                    <p className="text-xs text-gray-500 mt-2">
                      Typically {formatDocumentValidity(doc)?.toLowerCase()}
                    </p>
                  )}
                  {!existing && expiryValue && (
                    <p className="text-xs text-gray-500 mt-2">
                      Upload the document first, then save the expiration date.
                    </p>
                  )}
                </div>
              )}

              {existing && (
                <div className="mb-4">
                  {getFilePreview(existing)}
                  {existing.expires_at && (
                    <p
                      className={`text-xs mt-2 ${
                        isDocumentExpired(existing.expires_at)
                          ? 'text-red-600 font-medium'
                          : 'text-gray-500'
                      }`}
                    >
                      Expires: {new Date(existing.expires_at).toLocaleDateString()}
                      {isDocumentExpired(existing.expires_at) && ' — expired, please re-upload'}
                    </p>
                  )}
                  {existing.rejection_reason && (
                    <p className="text-xs text-red-600 mt-2 border-l-2 border-red-300 pl-2">
                      Reason: {existing.rejection_reason}
                    </p>
                  )}
                </div>
              )}

              {doc.uploadable ? (
                <label className="block w-full cursor-pointer">
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => handleUpload(doc.type, e)} />
                  <div className="text-center border-2 border-dashed border-gray-300 hover:border-[#1E3A8A] rounded-xl py-6 transition-colors">
                    {isUploading ? 'Uploading...' : existing ? 'Replace Document' : 'Upload Document'}
                  </div>
                </label>
              ) : (
                <button className="w-full py-3 border border-[#1E3A8A] text-[#1E3A8A] rounded-xl hover:bg-gray-50">
                  {doc.actionLabel || 'Manage'}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {previewUrl && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={() => setPreviewUrl(null)}>
          <div className="relative max-w-4xl max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <img src={previewUrl} alt="Preview" className="max-w-full max-h-[90vh] rounded-lg shadow-2xl" />
            <button onClick={() => setPreviewUrl(null)} className="absolute -top-4 -right-4 bg-white text-black w-10 h-10 rounded-full flex items-center justify-center text-2xl shadow-lg">✕</button>
          </div>
        </div>
      )}
    </div>
  );
}