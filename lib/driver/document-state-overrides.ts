import { KANSAS_ACCIDENT_PREVENTION_COURSE_DESCRIPTION } from '@/lib/driver/accident-prevention-course-copy';
import type { RequiredDocument } from '@/lib/driver/document-catalog';

/** Fields that may differ per operating state (everything else stays in the catalog). */
export type StateDocumentOverride = Partial<
  Pick<
    RequiredDocument,
    | 'description'
    | 'label'
    | 'category'
    | 'cost'
    | 'specialNote'
    | 'validityYears'
    | 'validityMonths'
  >
>;

/**
 * State-specific document copy overrides.
 *
 * Pattern:
 * - Put default labels/descriptions in `document-catalog.ts`.
 * - Add entries here only when a state needs different copy (e.g. Kansas K.A.R. text).
 * - Keys are uppercase USPS state codes; document keys match `document_type` ids.
 *
 * When a driver operates in multiple states, the override with the longest
 * `description` wins (same behavior as the former DB description merge).
 */
export const STATE_DOCUMENT_OVERRIDES: Record<
  string,
  Record<string, StateDocumentOverride>
> = {
  KS: {
    accident_prevention_course: {
      description: KANSAS_ACCIDENT_PREVENTION_COURSE_DESCRIPTION,
    },
  },
};

export function getStateDocumentOverride(
  stateCode: string,
  documentType: string
): StateDocumentOverride | undefined {
  const state = stateCode.trim().toUpperCase();
  return STATE_DOCUMENT_OVERRIDES[state]?.[documentType];
}