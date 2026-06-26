import {
  DEFAULT_DOCUMENT_TYPES,
  DRIVER_DOCUMENT_CATALOG,
  getCatalogDocument,
  type RequiredDocument,
} from '@/lib/driver/document-catalog';
import { getDefaultRequiredDocuments, resolveRequiredDocuments } from '@/lib/driver/resolve-driver-documents';

export type { RequiredDocument };

export function formatDocumentValidity(doc: RequiredDocument): string | null {
  if (doc.validityMonths) {
    return `Valid for ${doc.validityMonths} months`;
  }
  if (doc.validityYears) {
    return `Valid for ${doc.validityYears} year${doc.validityYears === 1 ? '' : 's'}`;
  }
  return null;
}

/** @deprecated Use getDefaultRequiredDocuments() or resolveRequiredDocumentsForStates() */
export const requiredDriverDocuments: RequiredDocument[] = getDefaultRequiredDocuments();

export { DEFAULT_DOCUMENT_TYPES, DRIVER_DOCUMENT_CATALOG, resolveRequiredDocuments };

/** Legacy document type aliases (renames, historical ids). */
const DOCUMENT_TYPE_ALIASES: Record<string, string[]> = {
  saferide_course: ['everdriven_saferide_course'],
  dot_physical: ['kansas_dot_physical'],
  accident_prevention_course: ['kansas_accident_prevention'],
};

export function getRequiredDocument(type: string): RequiredDocument | undefined {
  return getCatalogDocument(type) ?? getCatalogDocument(normalizeLegacyDocumentType(type));
}

function normalizeLegacyDocumentType(type: string): string {
  if (DRIVER_DOCUMENT_CATALOG[type]) return type;
  for (const [canonical, aliases] of Object.entries(DOCUMENT_TYPE_ALIASES)) {
    if (aliases.includes(type)) return canonical;
  }
  return type;
}

export function documentRequiresExpiration(type: string): boolean {
  return getRequiredDocument(type)?.requiresExpiration === true;
}

export function findDriverDocument<T extends { document_type: string }>(
  documents: T[],
  type: string
): T | undefined {
  const aliases = DOCUMENT_TYPE_ALIASES[type] ?? [];
  const legacyKeys = Object.entries(DOCUMENT_TYPE_ALIASES)
    .filter(([, list]) => list.includes(type))
    .map(([canonical]) => canonical);

  const matchTypes = new Set([type, ...aliases, ...legacyKeys]);

  return documents.find((d) => matchTypes.has(d.document_type));
}