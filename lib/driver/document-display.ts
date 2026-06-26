import { DRIVER_DOCUMENT_CATALOG, getCatalogDocument } from '@/lib/driver/document-catalog';
import { LEGACY_DRIVERS_LICENSE } from '@/lib/driver/drivers-license-documents';

const CATALOG_SORT_ORDER = new Map(
  Object.keys(DRIVER_DOCUMENT_CATALOG).map((type, index) => [type, index])
);

const DEPRECATED_DOCUMENT_LABELS: Record<string, string> = {
  [LEGACY_DRIVERS_LICENSE]: "Driver's License (Legacy combined upload)",
};

/** Human-readable label for driver/admin document UIs. */
export function getDocumentDisplayLabel(documentType: string): string {
  const catalog = getCatalogDocument(documentType);
  if (catalog) return catalog.label;
  if (DEPRECATED_DOCUMENT_LABELS[documentType]) {
    return DEPRECATED_DOCUMENT_LABELS[documentType];
  }
  return documentType.replace(/_/g, ' ');
}

export function isDeprecatedDocumentType(documentType: string): boolean {
  return documentType === LEGACY_DRIVERS_LICENSE;
}

export function getDocumentReviewSortOrder(documentType: string): number {
  const catalogOrder = CATALOG_SORT_ORDER.get(documentType);
  if (catalogOrder != null) return catalogOrder;
  if (documentType === LEGACY_DRIVERS_LICENSE) return 10_000;
  return 5_000;
}

export function sortDocumentsForReview<T extends { document_type: string }>(
  documents: T[]
): T[] {
  return [...documents].sort(
    (a, b) =>
      getDocumentReviewSortOrder(a.document_type) -
      getDocumentReviewSortOrder(b.document_type)
  );
}