import type { RequiredDocument } from '@/lib/driver/required-documents';

export type DocumentCategory = {
  id: string;
  title: string;
  examples: string;
  description: string;
  types: readonly string[];
};

export const DOCUMENT_CATEGORIES: DocumentCategory[] = [
  {
    id: 'licensing',
    title: 'Licensing & Identification',
    examples: "Driver's License, SSN Card, Birth Certificate / Passport",
    description: 'Core ID documents',
    types: ['drivers_license', 'ssn_card', 'birth_certificate_passport'],
  },
  {
    id: 'vehicle',
    title: 'Vehicle Requirements',
    examples: 'Vehicle Registration, Proof of Insurance, Vehicle Inspection',
    description: 'Vehicle-related docs',
    types: ['vehicle_registration', 'proof_of_insurance', 'vehicle_inspection'],
  },
  {
    id: 'compliance',
    title: 'Compliance & Background',
    examples: 'DOT Physical, Background Check, Drug Test, Driving Record',
    description: 'Safety & compliance',
    types: [
      'dot_physical',
      'background_check_fingerprinting',
      'drug_test',
      'driving_record',
      'tb_test',
    ],
  },
  {
    id: 'training',
    title: 'Training & Certifications',
    examples: 'SafeRide Course, First Aid/CPR, Defensive Driving, Child Seat Training',
    description: 'Required training',
    types: [
      'saferide_course',
      'cpr_training',
      'first_aid_training',
      'defensive_driving',
      'child_seat_training',
      'accident_prevention_course',
      'safety_meetings',
    ],
  },
];

const OTHER_CATEGORY: DocumentCategory = {
  id: 'other',
  title: 'Other',
  examples: 'State-specific or additional requirements',
  description: 'Catch-all',
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