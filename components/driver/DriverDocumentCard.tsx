'use client';

import { Check, ExternalLink, FileText, Upload } from 'lucide-react';
import {
  formatDocumentValidity,
  type RequiredDocument,
} from '@/lib/driver/required-documents';
import { isDocumentExpired } from '@/lib/driver/document-expiration';

export type DriverDocumentRecord = {
  id: string;
  document_type: string;
  file_url: string;
  file_name: string;
  uploaded_at: string;
  expires_at?: string;
  status: string;
  rejection_reason?: string;
};

type ExpirySaveStatus = 'idle' | 'saving' | 'saved' | 'error';

type DriverDocumentCardProps = {
  doc: RequiredDocument;
  existing?: DriverDocumentRecord;
  expiryValue: string;
  expirySaveStatus: ExpirySaveStatus;
  expirySaveError?: string;
  isUploading: boolean;
  onExpiryChange: (value: string) => void;
  onExpiryBlur: () => void;
  onUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onPreview: (url: string) => void;
};

function resolveStatusLabel(existing?: DriverDocumentRecord): string {
  if (!existing) return 'Not Uploaded';
  if (isDocumentExpired(existing.expires_at) && existing.status !== 'rejected') {
    return 'Expired';
  }
  switch (existing.status) {
    case 'approved':
      return 'Approved';
    case 'rejected':
      return 'Rejected';
    case 'pending_review':
      return 'Pending Review';
    default:
      return 'Uploaded';
  }
}

function statusBadgeClass(label: string): string {
  if (label === 'Approved') return 'bg-emerald-50 text-emerald-800 border-emerald-200';
  if (label === 'Rejected' || label === 'Expired') {
    return 'bg-red-50 text-red-800 border-red-200';
  }
  if (label === 'Pending Review') return 'bg-amber-50 text-amber-800 border-amber-200';
  if (label === 'Uploaded') return 'bg-blue-50 text-blue-800 border-blue-200';
  return 'bg-gray-50 text-gray-600 border-gray-200';
}

function ExpirySaveIndicator({
  status,
  error,
}: {
  status: ExpirySaveStatus;
  error?: string;
}) {
  if (status === 'saving') {
    return <span className="text-xs text-gray-500">Saving…</span>;
  }
  if (status === 'saved') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
        <Check size={14} strokeWidth={2.5} aria-hidden />
        Saved
      </span>
    );
  }
  if (status === 'error' && error) {
    return <span className="text-xs text-red-600">{error}</span>;
  }
  return null;
}

export default function DriverDocumentCard({
  doc,
  existing,
  expiryValue,
  expirySaveStatus,
  expirySaveError,
  isUploading,
  onExpiryChange,
  onExpiryBlur,
  onUpload,
  onPreview,
}: DriverDocumentCardProps) {
  const statusLabel = resolveStatusLabel(existing);
  const showExpiration = doc.requiresExpiration === true || !!doc.validityYears;
  const validityText = formatDocumentValidity(doc);
  const isImage = existing ? /\.(jpg|jpeg|png|gif)$/i.test(existing.file_name) : false;

  return (
    <article
      id={`doc-${doc.type}`}
      className="scroll-mt-24 rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:border-blue-200 hover:shadow-md"
    >
      <div className="border-b border-gray-100 px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-blue-950">{doc.label}</h2>
              <span className="inline-flex rounded-full border border-blue-100 bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-blue-800">
                Required
              </span>
            </div>
            {doc.description && (
              <p className="mt-2 text-sm leading-relaxed text-gray-600">{doc.description}</p>
            )}
          </div>
          <span
            className={`inline-flex shrink-0 self-start rounded-full border px-3 py-1 text-xs font-semibold ${statusBadgeClass(statusLabel)}`}
          >
            {statusLabel}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-gray-600">
          <span>
            Cost:{' '}
            <span
              className={
                doc.cost.includes('Driver') ? 'font-medium text-orange-700' : 'font-medium text-emerald-700'
              }
            >
              {doc.cost}
            </span>
          </span>
          {validityText && <span>{validityText}</span>}
          {doc.specialNote && <span className="italic text-gray-500">{doc.specialNote}</span>}
        </div>
      </div>

      <div className="space-y-5 px-5 py-5 sm:px-6">
        {showExpiration && (
          <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <label htmlFor={`expiry-${doc.type}`} className="text-sm font-medium text-blue-950">
                Expiration date{doc.requiresExpiration ? ' *' : ''}
              </label>
              <ExpirySaveIndicator status={expirySaveStatus} error={expirySaveError} />
            </div>
            <input
              id={`expiry-${doc.type}`}
              type="date"
              required={doc.requiresExpiration}
              min={new Date().toISOString().split('T')[0]}
              value={expiryValue}
              onChange={(event) => onExpiryChange(event.target.value)}
              onBlur={onExpiryBlur}
              className="w-full max-w-xs rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-blue-950 focus:border-[#1E3A8A] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/20"
              aria-describedby={!existing && expiryValue ? `expiry-hint-${doc.type}` : undefined}
            />
            {validityText && (
              <p className="mt-2 text-xs text-gray-500">
                Typically {validityText.toLowerCase()}
              </p>
            )}
            {!existing && expiryValue && (
              <p id={`expiry-hint-${doc.type}`} className="mt-2 text-xs text-gray-500">
                Date will be saved when you upload this document.
              </p>
            )}
            {existing && (
              <p className="mt-2 text-xs text-gray-500">Changes save automatically.</p>
            )}
          </div>
        )}

        {existing && (
          <div className="flex flex-col gap-4 rounded-xl border border-gray-100 bg-gray-50/50 p-4 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-4">
              {isImage ? (
                <button
                  type="button"
                  onClick={() => onPreview(existing.file_url)}
                  className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-gray-200 bg-white"
                >
                  <img
                    src={existing.file_url}
                    alt={existing.file_name}
                    className="h-full w-full object-cover"
                  />
                </button>
              ) : (
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white">
                  <FileText className="h-8 w-8 text-gray-400" strokeWidth={1.5} aria-hidden />
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-blue-950">{existing.file_name}</p>
                <p className="mt-1 text-xs text-gray-500">
                  Uploaded {new Date(existing.uploaded_at).toLocaleDateString()}
                </p>
                {existing.expires_at && (
                  <p
                    className={`mt-1 text-xs ${
                      isDocumentExpired(existing.expires_at)
                        ? 'font-medium text-red-600'
                        : 'text-gray-500'
                    }`}
                  >
                    Expires {new Date(existing.expires_at).toLocaleDateString()}
                    {isDocumentExpired(existing.expires_at) && ' — please re-upload'}
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() =>
                isImage ? onPreview(existing.file_url) : window.open(existing.file_url, '_blank')
              }
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-blue-950 transition hover:bg-gray-50"
            >
              <ExternalLink size={16} strokeWidth={2} aria-hidden />
              View
            </button>
          </div>
        )}

        {existing?.rejection_reason && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <span className="font-semibold">Rejection reason:</span> {existing.rejection_reason}
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {doc.uploadable ? (
            <label className="inline-flex flex-1 cursor-pointer sm:max-w-xs">
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                className="hidden"
                onChange={onUpload}
              />
              <span className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1E3A8A] px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-900">
                <Upload size={16} strokeWidth={2} aria-hidden />
                {isUploading
                  ? 'Uploading…'
                  : existing
                    ? 'Re-upload Document'
                    : 'Upload Document'}
              </span>
            </label>
          ) : (
            <button
              type="button"
              className="inline-flex flex-1 items-center justify-center rounded-xl border-2 border-[#1E3A8A] px-5 py-3 text-sm font-semibold text-[#1E3A8A] transition hover:bg-blue-50 sm:max-w-xs"
            >
              {doc.actionLabel || 'Manage'}
            </button>
          )}
          <p className="text-xs text-gray-500">PDF, JPG, or PNG · max 10 MB</p>
        </div>
      </div>
    </article>
  );
}