import {
  DEFAULT_DOCUMENT_TYPES,
  DRIVER_DOCUMENT_CATALOG,
  getCatalogDocument,
} from '@/lib/driver/document-catalog';
import type { RequiredDocument } from '@/lib/driver/required-documents';
import { normalizeStateCodes } from '@/lib/driver/us-states';

export type StateRequirementRow = {
  state_code: string;
  document_type: string;
  sort_order: number;
  is_required: boolean;
};

/**
 * Union required document types across selected states, preserving lowest sort_order.
 */
export function unionDocumentTypesFromStateRows(
  rows: StateRequirementRow[],
  drivingStates: string[]
): string[] {
  const states = normalizeStateCodes(drivingStates);
  if (states.length === 0) return [];

  const relevant = rows.filter(
    (row) => states.includes(row.state_code.toUpperCase()) && row.is_required
  );

  const orderMap = new Map<string, number>();
  for (const row of relevant) {
    const type = row.document_type;
    const current = orderMap.get(type);
    if (current == null || row.sort_order < current) {
      orderMap.set(type, row.sort_order);
    }
  }

  return Array.from(orderMap.entries())
    .sort((a, b) => a[1] - b[1])
    .map(([type]) => type);
}

/** Resolve catalog entries for a list of document type ids. */
export function resolveRequiredDocuments(documentTypes: string[]): RequiredDocument[] {
  const seen = new Set<string>();
  const resolved: RequiredDocument[] = [];

  for (const type of documentTypes) {
    if (seen.has(type)) continue;
    const doc = getCatalogDocument(type);
    if (!doc) continue;
    seen.add(type);
    resolved.push(doc);
  }

  return resolved;
}

/** Fallback when DB rows are unavailable — default set for all states. */
export function getDefaultRequiredDocuments(): RequiredDocument[] {
  return resolveRequiredDocuments([...DEFAULT_DOCUMENT_TYPES]);
}

/** Full catalog list (marketing / admin reference). */
export function getAllCatalogDocuments(): RequiredDocument[] {
  return resolveRequiredDocuments(Object.keys(DRIVER_DOCUMENT_CATALOG));
}

export function resolveRequiredDocumentsForStates(
  drivingStates: string[],
  stateRows: StateRequirementRow[]
): RequiredDocument[] {
  const types = unionDocumentTypesFromStateRows(stateRows, drivingStates);
  if (types.length === 0) return [];
  return resolveRequiredDocuments(types);
}