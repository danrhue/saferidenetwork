/**
 * Driver document metadata catalog — single source of truth for display copy.
 *
 * Supabase `state_document_requirements` controls *which* documents are required
 * per state (`state_code`, `document_type`, `is_required`, `sort_order`).
 * All labels, descriptions, categories, and costs live here.
 *
 * State-specific copy (e.g. Kansas K.A.R. 91-38-6) → `document-state-overrides.ts`.
 */
import {
  DEFAULT_ACCIDENT_PREVENTION_COURSE_DESCRIPTION,
} from '@/lib/driver/accident-prevention-course-copy';

export const DOCUMENT_CATEGORY_IDS = [
  'licensing',
  'vehicle',
  'compliance',
  'training',
  'other',
] as const;

export type DocumentCategoryId = (typeof DOCUMENT_CATEGORY_IDS)[number];

export type DocumentCategoryMeta = {
  title: string;
  examples: string;
  description: string;
};

/** UI section metadata for My Documents category headers. */
export const DOCUMENT_CATEGORY_META: Record<DocumentCategoryId, DocumentCategoryMeta> = {
  licensing: {
    title: 'Licensing & Identification',
    examples: "Driver's License (Front & Back), SSN Card, Birth Certificate / Passport",
    description: 'Core ID documents',
  },
  vehicle: {
    title: 'Vehicle Requirements',
    examples: 'Vehicle Registration, Proof of Insurance, Vehicle Inspection',
    description: 'Vehicle-related docs',
  },
  compliance: {
    title: 'Compliance & Background',
    examples: 'DOT Physical, Background Check, Drug Test, English Proficiency',
    description: 'Safety & compliance',
  },
  training: {
    title: 'Training & Certifications',
    examples: 'SafeRide Course, First Aid/CPR, Defensive Driving, Accident Prevention',
    description: 'Required training',
  },
  other: {
    title: 'Other',
    examples: 'State-specific or additional requirements',
    description: 'Catch-all',
  },
};

/** Display order for category sections on My Documents. */
export const DOCUMENT_CATEGORY_ORDER: DocumentCategoryId[] = [
  'licensing',
  'vehicle',
  'compliance',
  'training',
  'other',
];

export type DocumentFormDownload = {
  label: string;
  url: string;
};

export type RequiredDocument = {
  type: string;
  label: string;
  category: DocumentCategoryId;
  cost: string;
  description: string;
  validityYears?: number;
  validityMonths?: number;
  specialNote?: string;
  uploadable: boolean;
  actionLabel?: string;
  requiresExpiration?: boolean;
  /** Override header cost color (default: orange when cost mentions "Driver", else green). */
  costHighlight?: 'green' | 'orange';
  /** Optional blank form drivers can download before uploading a completed copy. */
  formDownload?: DocumentFormDownload;
};

/** Default document types seeded for every state (generic labels — no state names). */
export const DEFAULT_DOCUMENT_TYPES = [
  'drivers_license_front',
  'drivers_license_back',
  'proof_of_insurance',
  'vehicle_registration',
  'vehicle_inspection',
  'english_language_proficiency',
  'background_check_fingerprinting',
  'drug_test',
  'saferide_course',
  'dot_physical',
  'accident_prevention_course',
  'tb_test',
  'cpr_training',
  'first_aid_cpr_aed',
  'first_aid_training',
  'defensive_driving',
  'safety_meetings',
] as const;

export type DefaultDocumentType = (typeof DEFAULT_DOCUMENT_TYPES)[number];

/** Master catalog — metadata for all possible driver documents. */
export const DRIVER_DOCUMENT_CATALOG: Record<string, RequiredDocument> = {
  drivers_license_front: {
    type: 'drivers_license_front',
    label: "Driver's License — Front",
    category: 'licensing',
    cost: 'No cost',
    description:
      "Upload a clear photo or scan of the front of your valid driver's license. Upload the front only — do not include the back in this file. Enter the license expiration date when uploading.",
    uploadable: true,
    requiresExpiration: true,
    validityYears: 4,
    specialNote: 'Also upload the back as a separate file on the card below.',
  },
  drivers_license_back: {
    type: 'drivers_license_back',
    label: "Driver's License — Back",
    category: 'licensing',
    cost: 'No cost',
    description:
      "Upload a clear photo or scan of the back of your valid driver's license. Upload the back only — do not combine it with the front in one image.",
    uploadable: true,
    specialNote: 'Must be a separate upload from the front of your license.',
  },
  ssn_card: {
    type: 'ssn_card',
    label: 'SSN Card',
    category: 'licensing',
    cost: 'No cost',
    description: 'Upload a copy of your Social Security card for identity verification.',
    uploadable: true,
  },
  birth_certificate_passport: {
    type: 'birth_certificate_passport',
    label: 'Birth Certificate / Passport',
    category: 'licensing',
    cost: 'No cost',
    description:
      'Upload a copy of your birth certificate or passport for identity verification.',
    uploadable: true,
  },
  proof_of_insurance: {
    type: 'proof_of_insurance',
    label: 'Proof of Insurance',
    category: 'vehicle',
    cost: 'No cost',
    description:
      'Upload proof of liability insurance for the vehicle you will use on SafeRide trips. The policy must be current and show adequate coverage for passenger transport.',
    uploadable: true,
    requiresExpiration: true,
    validityYears: 1,
  },
  vehicle_registration: {
    type: 'vehicle_registration',
    label: 'Vehicle Registration',
    category: 'vehicle',
    cost: 'No cost',
    description:
      'Upload your current vehicle registration for the vehicle you plan to use on trips.',
    uploadable: true,
    requiresExpiration: true,
    validityYears: 2,
  },
  vehicle_inspection: {
    type: 'vehicle_inspection',
    label: 'Vehicle Inspection by a certified mechanic',
    category: 'vehicle',
    cost: 'Driver is responsible for the cost',
    description:
      'Upload documentation of a vehicle inspection performed by a certified mechanic. The inspection confirms your vehicle meets SafeRide safety standards.',
    uploadable: true,
    requiresExpiration: true,
  },
  missouri_vehicle_inspection: {
    type: 'missouri_vehicle_inspection',
    label: 'Missouri Certified Mechanic Vehicle Inspection Form',
    category: 'vehicle',
    cost: 'Driver is responsible for the cost',
    description:
      'Missouri Vehicle Inspection (Certified Mechanic)\n\nRequired for Missouri\n\nYou must have a certified mechanic complete the official State of Missouri Certified Mechanic Vehicle Inspection Form. This inspection is required for all vehicles used for student transportation in Missouri.\n\nHow to complete:\n• Download the Missouri Certified Mechanic Vehicle Inspection Form\n• Take your vehicle to a certified mechanic\n• Have them complete and sign all sections of the form\n• Upload the completed and signed form\n\nNote: This is a specific mechanic inspection required for student transport vehicles in Missouri. It is different from a standard state safety inspection.',
    uploadable: true,
    requiresExpiration: true,
    specialNote: 'Missouri drivers only — separate from the general vehicle inspection requirement.',
    formDownload: {
      label: 'Download Missouri Inspection Form',
      url: 'https://iwnhwunwsbijnzqrgskq.supabase.co/storage/v1/object/public/documents/State%20of%20Missouri%20Certified%20Mechanic%20Vehicle%20Inspection%20Form.pdf',
    },
  },
  english_language_proficiency: {
    type: 'english_language_proficiency',
    label: 'English Language Proficiency (Hallo.ai)',
    category: 'compliance',
    cost: 'No cost',
    description:
      'Demonstrate English proficiency by completing the assessment on Hallo.ai and uploading your certificate.\n\nHow to complete:\n• Go to https://hallo.ai/ and complete the English proficiency assessment\n• Upload your certificate of completion here',
    uploadable: true,
    specialNote: 'Complete on Hallo.ai and upload certificate',
  },
  background_check_fingerprinting: {
    type: 'background_check_fingerprinting',
    label: 'Background Check & Fingerprinting',
    category: 'compliance',
    cost: 'No cost',
    description:
      'SafeRide coordinates background screening and fingerprinting for eligible drivers. Use the button on this card to request screening or view your current status. No file upload is required unless you are instructed otherwise.',
    uploadable: false,
    actionLabel: 'Request / View Status',
  },
  drug_test: {
    type: 'drug_test',
    label: 'Drug Test',
    category: 'compliance',
    cost: 'No cost (scheduled through Checkers)',
    description:
      'Complete your required drug screening through Checkers (scheduled by SafeRide). Upload your test results when you receive them.',
    uploadable: true,
    specialNote: 'Upload results when received',
  },
  driving_record: {
    type: 'driving_record',
    label: 'Driving Record (MVR)',
    category: 'compliance',
    cost: 'Driver may be responsible for the cost',
    description:
      'Upload a current motor vehicle record (MVR) from your state DMV or licensing authority.',
    uploadable: true,
    requiresExpiration: true,
    validityYears: 1,
  },
  saferide_course: {
    type: 'saferide_course',
    label: 'SafeRide Course',
    category: 'training',
    cost: '$25 (paid by you)',
    description:
      'You must complete the SafeRide training course before driving.\nCost: $25 (paid by you)\n\nHow to complete:\nGo to https://everdriven.talentlms.com/\nClick Signup in the upper right.\nCreate your account and log in.\nClick Get your first course.\nSelect the course that matches your language and vehicle type.\n\nNote: The wheelchair accessible vehicle course also covers non-wheelchair vehicles (it just has one extra module).',
    uploadable: true,
    specialNote: 'Upload your completion certificate after finishing the course on TalentLMS.',
  },
  dot_physical: {
    type: 'dot_physical',
    label: 'DOT Physical Examination',
    category: 'compliance',
    cost: 'Driver is responsible for the cost',
    description:
      "Upload your current DOT physical examination card (Medical Examiner's Certificate). Required for drivers operating vehicles that need a DOT medical card.\n\nRenew every 2 years, or as noted on your card.",
    validityYears: 2,
    uploadable: true,
    requiresExpiration: true,
  },
  accident_prevention_course: {
    type: 'accident_prevention_course',
    label: 'Vehicle Accident Prevention Course',
    category: 'training',
    cost: 'Typically $20–$30 (paid by you)',
    description: DEFAULT_ACCIDENT_PREVENTION_COURSE_DESCRIPTION,
    validityYears: 3,
    uploadable: true,
    requiresExpiration: true,
  },
  tb_test: {
    type: 'tb_test',
    label: 'TB Test Results (Good for 4 years)',
    category: 'compliance',
    cost: 'Driver is responsible for the cost',
    description:
      'Upload a copy of your TB test results. The test must be completed within 90 days of starting and renewed every 4 years. Visit a local health facility for a TB skin test — you are responsible for the cost.',
    validityMonths: 48,
    validityYears: 4,
    uploadable: true,
    requiresExpiration: true,
  },
  cpr_training: {
    type: 'cpr_training',
    label: 'CPR Training Record',
    category: 'training',
    cost: 'Driver is responsible for the cost',
    description:
      'Upload proof of current CPR certification from an accredited provider. Renewal is typically required every 2 years.',
    validityYears: 2,
    uploadable: true,
    requiresExpiration: true,
  },
  first_aid_cpr_aed: {
    type: 'first_aid_cpr_aed',
    label: 'First Aid & CPR/AED Certification',
    category: 'training',
    cost: 'Driver is responsible for the cost',
    costHighlight: 'green',
    description:
      'Hold a current First Aid and CPR/AED certification from an approved provider.\n\nRequirements:\n• Must include both First Aid and CPR/AED\n• Renew every 2 years (some courses require a hands-on skills session)\n\nApproved providers:\n• American Red Cross — https://www.redcross.org/take-a-class/classes/adult-first-aid%2Fcpr%2Faed-online/a6RVx000000Xi3t.html (~$35–$45)\n• American Heart Association — https://shopcpr.heart.org/heartsaver-first-aid-cpr-aed-online (~$40–$55)\n• National Safety Council (NSC) — https://www.nsc.org/safety-training/first-aid (~$30–$60)\n• HSI / ASHI — https://www.hsi.com/ (~$25–$50)\n\nUpload your certificate when complete.',
    validityYears: 2,
    uploadable: true,
    requiresExpiration: true,
  },
  first_aid_training: {
    type: 'first_aid_training',
    label: 'First Aid Training Record',
    category: 'training',
    cost: 'Driver is responsible for the cost',
    description:
      'Upload proof of current first aid training or certification. Renewal is typically required every 2 years.',
    validityYears: 2,
    uploadable: true,
    requiresExpiration: true,
  },
  defensive_driving: {
    type: 'defensive_driving',
    label: 'Defensive Driving Course',
    category: 'training',
    cost: 'Driver is responsible for the cost',
    description:
      'Upload your certificate from an approved defensive driving course. Renewal is typically required every 2 years.',
    validityYears: 2,
    uploadable: true,
    requiresExpiration: true,
  },
  child_seat_training: {
    type: 'child_seat_training',
    label: 'Child Seat Training',
    category: 'training',
    cost: 'Driver is responsible for the cost',
    description:
      'Upload proof of child passenger safety / car seat installation training from an accredited program.',
    uploadable: true,
    requiresExpiration: true,
    validityYears: 2,
  },
  safety_meetings: {
    type: 'safety_meetings',
    label: 'Safety Meetings / Safety Rosters',
    category: 'training',
    cost: 'No cost',
    description:
      'Upload safety meeting attendance records or safety rosters as required by your operating organization or state regulations. You may upload multiple files.',
    uploadable: true,
    specialNote: 'You may upload multiple files',
  },
};

export function getCatalogDocument(type: string): RequiredDocument | undefined {
  return DRIVER_DOCUMENT_CATALOG[type];
}

export function getDocumentCategoryMeta(categoryId: DocumentCategoryId): DocumentCategoryMeta {
  return DOCUMENT_CATEGORY_META[categoryId];
}