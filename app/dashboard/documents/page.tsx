'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import DocumentCategorySection from '@/components/driver/DocumentCategorySection';
import DriverDocumentCard, {
  type DriverDocumentRecord,
} from '@/components/driver/DriverDocumentCard';
import { groupDocumentsByCategory } from '@/lib/driver/document-categories';
import { findDriverDocument } from '@/lib/driver/required-documents';
import { toDateInputValue } from '@/lib/driver/document-dates';
import { useRequiredDriverDocuments } from '@/lib/driver/useRequiredDriverDocuments';
import { useProfileCompletion } from '@/lib/driver/useProfileCompletion';
import { formatStateList } from '@/lib/driver/us-states';
import { uploadDriverDocument } from '@/app/actions/driver-documents';

type ExpirySaveStatus = 'idle' | 'saving' | 'saved' | 'error';

const EXPIRY_SAVE_DEBOUNCE_MS = 600;
const SAVED_INDICATOR_MS = 2500;

export default function DriverDocumentsPage() {
  const {
    loading: requirementsLoading,
    documents: requiredDocuments,
    drivingStates,
    message: requirementsMessage,
  } = useRequiredDriverDocuments();
  const { refresh: refreshProfileCompletion } = useProfileCompletion();
  const [documents, setDocuments] = useState<DriverDocumentRecord[]>([]);
  const [uploading, setUploading] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [expiryDates, setExpiryDates] = useState<Record<string, string>>({});
  const [expirySaveStatus, setExpirySaveStatus] = useState<
    Record<string, ExpirySaveStatus>
  >({});
  const [expirySaveError, setExpirySaveError] = useState<Record<string, string>>({});
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const savedIndicatorTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    fetchDocuments();
  }, []);

  useEffect(() => {
    return () => {
      Object.values(debounceTimers.current).forEach(clearTimeout);
      Object.values(savedIndicatorTimers.current).forEach(clearTimeout);
    };
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

  const syncExpiryDatesFromDocuments = (docs: DriverDocumentRecord[]) => {
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

  const resolveExpiryForUpload = (documentType: string, existing?: DriverDocumentRecord) => {
    if (expiryDates[documentType]) {
      return expiryDates[documentType];
    }
    if (existing?.expires_at) {
      return toDateInputValue(existing.expires_at);
    }
    return undefined;
  };

  const showSavedIndicator = useCallback((documentType: string) => {
    if (savedIndicatorTimers.current[documentType]) {
      clearTimeout(savedIndicatorTimers.current[documentType]);
    }
    setExpirySaveStatus((prev) => ({ ...prev, [documentType]: 'saved' }));
    savedIndicatorTimers.current[documentType] = setTimeout(() => {
      setExpirySaveStatus((prev) => ({ ...prev, [documentType]: 'idle' }));
      delete savedIndicatorTimers.current[documentType];
    }, SAVED_INDICATOR_MS);
  }, []);

  const persistExpirationDate = useCallback(
    async (documentType: string, date: string) => {
      if (!date) return;

      if (new Date(`${date}T23:59:59Z`).getTime() <= Date.now()) {
        setExpirySaveStatus((prev) => ({ ...prev, [documentType]: 'error' }));
        setExpirySaveError((prev) => ({
          ...prev,
          [documentType]: 'Expiration date must be in the future.',
        }));
        return;
      }

      const existing = findDriverDocument(documents, documentType);
      if (!existing) {
        return;
      }

      if (
        existing.expires_at &&
        toDateInputValue(existing.expires_at) === date
      ) {
        return;
      }

      setExpirySaveStatus((prev) => ({ ...prev, [documentType]: 'saving' }));
      setExpirySaveError((prev) => ({ ...prev, [documentType]: '' }));

      try {
        const res = await fetch('/api/driver/update-expiry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documentType, expiresAt: date }),
        });

        const data = await res.json().catch(() => ({}));

        if (res.ok) {
          await fetchDocuments();
          showSavedIndicator(documentType);
        } else {
          setExpirySaveStatus((prev) => ({ ...prev, [documentType]: 'error' }));
          setExpirySaveError((prev) => ({
            ...prev,
            [documentType]: data.error || 'Failed to save expiration date.',
          }));
        }
      } catch {
        setExpirySaveStatus((prev) => ({ ...prev, [documentType]: 'error' }));
        setExpirySaveError((prev) => ({
          ...prev,
          [documentType]: 'Error saving expiration date.',
        }));
      }
    },
    [documents, showSavedIndicator]
  );

  const scheduleExpirySave = useCallback(
    (documentType: string, date: string) => {
      if (debounceTimers.current[documentType]) {
        clearTimeout(debounceTimers.current[documentType]);
      }
      debounceTimers.current[documentType] = setTimeout(() => {
        void persistExpirationDate(documentType, date);
        delete debounceTimers.current[documentType];
      }, EXPIRY_SAVE_DEBOUNCE_MS);
    },
    [persistExpirationDate]
  );

  const handleExpiryChange = (documentType: string, value: string) => {
    setExpiryDates((prev) => ({ ...prev, [documentType]: value }));
    setExpirySaveError((prev) => ({ ...prev, [documentType]: '' }));

    const existing = findDriverDocument(documents, documentType);
    if (existing && value) {
      setExpirySaveStatus((prev) => ({ ...prev, [documentType]: 'idle' }));
      scheduleExpirySave(documentType, value);
    }
  };

  const handleExpiryBlur = (documentType: string) => {
    if (debounceTimers.current[documentType]) {
      clearTimeout(debounceTimers.current[documentType]);
      delete debounceTimers.current[documentType];
    }
    const date = expiryDates[documentType];
    if (date) {
      void persistExpirationDate(documentType, date);
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
        await refreshProfileCompletion();
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

  const groupedCategories = groupDocumentsByCategory(requiredDocuments);

  const getCategoryApprovedCount = (types: string[]) =>
    types.filter((type) => approvedTypes.has(type)).length;

  if (requirementsLoading) {
    return (
      <div className="mx-auto flex max-w-7xl items-center justify-center px-4 py-20">
        <p className="font-medium text-blue-950">Loading document requirements…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-blue-950">My Documents</h1>
        <p className="mt-2 text-gray-600">
          Upload and manage compliance documents for your operating states.
        </p>
      </header>

      {drivingStates.length === 0 ? (
        <div className="mb-8 rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:p-6">
          <p className="font-semibold text-amber-900">Select your operating states first</p>
          <p className="mt-1 text-sm text-amber-800">
            {requirementsMessage ||
              'Choose the states where you plan to drive so we can show the correct required documents.'}
          </p>
          <Link
            href="/dashboard/profile"
            className="mt-4 inline-flex rounded-xl bg-[#1E3A8A] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-900"
          >
            Set Operating States
          </Link>
        </div>
      ) : (
        <p className="mb-6 text-sm text-blue-800">
          Requirements for{' '}
          <span className="font-semibold">{formatStateList(drivingStates)}</span>
        </p>
      )}

      <section className="mb-8 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">Approval progress</p>
            <p className="mt-1 text-2xl font-bold text-blue-950">
              {approvedCount} of {totalRequired} approved
            </p>
            <p className="mt-1 text-sm text-gray-500">{uploadedCount} uploaded</p>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-4xl font-bold text-[#1E3A8A]">{progress}%</p>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Complete
            </p>
          </div>
        </div>
        <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </section>

      <div className="space-y-12">
        {groupedCategories.map((category) => (
          <DocumentCategorySection
            key={category.id}
            category={category}
            approvedCount={getCategoryApprovedCount(category.documents.map((doc) => doc.type))}
          >
            {category.documents.map((doc) => {
              const existing = findDriverDocument(documents, doc.type);
              const expiryValue =
                expiryDates[doc.type] ||
                (existing?.expires_at ? toDateInputValue(existing.expires_at) : '');

              return (
                <DriverDocumentCard
                  key={doc.type}
                  doc={doc}
                  existing={existing}
                  expiryValue={expiryValue}
                  expirySaveStatus={expirySaveStatus[doc.type] ?? 'idle'}
                  expirySaveError={expirySaveError[doc.type]}
                  isUploading={uploading === doc.type}
                  onExpiryChange={(value) => handleExpiryChange(doc.type, value)}
                  onExpiryBlur={() => handleExpiryBlur(doc.type)}
                  onUpload={(event) => void handleUpload(doc.type, event)}
                  onPreview={setPreviewUrl}
                />
              );
            })}
          </DocumentCategorySection>
        ))}
      </div>

      {requiredDocuments.length === 0 && drivingStates.length > 0 && (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-14 text-center">
          <p className="text-gray-600">No document requirements found for your selected states.</p>
        </div>
      )}

      {previewUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setPreviewUrl(null)}
        >
          <div
            className="relative max-h-[90vh] max-w-4xl"
            onClick={(event) => event.stopPropagation()}
          >
            <img
              src={previewUrl}
              alt="Document preview"
              className="max-h-[90vh] max-w-full rounded-lg shadow-2xl"
            />
            <button
              type="button"
              onClick={() => setPreviewUrl(null)}
              className="absolute -right-3 -top-3 flex h-10 w-10 items-center justify-center rounded-full bg-white text-xl text-black shadow-lg"
              aria-label="Close preview"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}