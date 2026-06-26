import type { RequiredDocument } from '@/lib/driver/required-documents';

export type DocumentCategory = {
  id: string;
  title: string;
  description: string;
  types: readonly string[];
};

export const DOCUMENT_CATEGORIES: DocumentCategory[] = [
  {
    id: 'licensing',
    title: 'Licensing & Identification',
    description: 'Identity and driving credentials',
    types: ['drivers_license', 'english_language_proficiency'],
  },
  {
    id: 'vehicle',
    title: 'Vehicle Requirements',
    description: 'Insurance, registration, and vehicle compliance',
    types: [
      'proof_of_insurance',
      'vehicle_registration',
      'vehicle_inspection',
      'dot_physical',
    ],
  },
  {
    id: 'compliance',
    title: 'Compliance & Background',
    description: 'Background checks, health screening, and compliance',
    types: ['background_check_fingerprinting', 'drug_test', 'tb_test'],
  },
  {
    id: 'training',
    title: 'Training & Certifications',
    description: 'Courses, certifications, and safety training',
    types: [
      'saferide_course',
      'accident_prevention_course',
      'cpr_training',
      'first_aid_training',
      'defensive_driving',
      'safety_meetings',
    ],
  },
];

const OTHER_CATEGORY: DocumentCategory = {
  id: 'other',
  title: 'Other Requirements',
  description: 'Additional state-specific requirements',
  types: [],
};

export type GroupedDocumentCategory = DocumentCategory & {
  documents: RequiredDocument[];
};

export function groupDocumentsByCategory(
  documents: RequiredDocument[]
): GroupedDocumentCategory[] {
  const assigned = new Set<string>();
  const groups: GroupedDocumentCategory[] = [];

  for (const category of DOCUMENT_CATEGORIES) {
    const categoryDocs = documents.filter((doc) => {
      if (!category.types.includes(doc.type)) return false;
      assigned.add(doc.type);
      return true;
    });

    if (categoryDocs.length > 0) {
      groups.push({ ...category, documents: categoryDocs });
    }
  }

  const uncategorized = documents.filter((doc) => !assigned.has(doc.type));
  if (uncategorized.length > 0) {
    groups.push({ ...OTHER_CATEGORY, documents: uncategorized });
  }

  return groups;
}