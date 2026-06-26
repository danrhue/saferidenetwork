import { isDocumentExpired } from '@/lib/driver/document-expiration';
import { findDriverDocument } from '@/lib/driver/required-documents';

export type DocumentCompletionRow = {
  document_type: string;
  status?: string;
  expires_at?: string | null;
};

export type RequiredDocumentForCompletion = {
  type: string;
  uploadable?: boolean;
};

function getUploadableRequired(required: RequiredDocumentForCompletion[]) {
  return required.filter((doc) => doc.uploadable !== false);
}

/** Count how many required upload slots have a matching driver upload. */
export function countUploadedRequiredDocuments(
  docs: DocumentCompletionRow[],
  required: RequiredDocumentForCompletion[]
): number {
  return getUploadableRequired(required).filter(
    (docDef) => !!findDriverDocument(docs, docDef.type)
  ).length;
}

/** Count required uploads that are approved and not expired. */
export function countApprovedRequiredDocuments(
  docs: DocumentCompletionRow[],
  required: RequiredDocumentForCompletion[]
): number {
  return getUploadableRequired(required).filter((docDef) => {
    const existing = findDriverDocument(docs, docDef.type);
    if (!existing) return false;
    if (existing.status !== 'approved') return false;
    if (isDocumentExpired(existing.expires_at)) return false;
    return true;
  }).length;
}

export function countRequiredUploadSlots(required: RequiredDocumentForCompletion[]): number {
  return getUploadableRequired(required).length;
}