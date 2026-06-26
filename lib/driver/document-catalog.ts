import {
  DEFAULT_ACCIDENT_PREVENTION_COURSE_DESCRIPTION,
} from '@/lib/driver/accident-prevention-course-copy';

export type RequiredDocument = {
  type: string;
  label: string;
  cost: string;
  description?: string;
  validityYears?: number;
  validityMonths?: number;
  specialNote?: string;
  uploadable: boolean;
  actionLabel?: string;
  requiresExpiration?: boolean;
};

/** Default document types seeded for every state (generic labels — no state names). */
export const DEFAULT_DOCUMENT_TYPES = [
  'drivers_license',
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
  'first_aid_training',
  'defensive_driving',
  'safety_meetings',
] as const;

export type DefaultDocumentType = (typeof DEFAULT_DOCUMENT_TYPES)[number];

/** Master catalog — metadata for all possible driver documents. */
export const DRIVER_DOCUMENT_CATALOG: Record<string, RequiredDocument> = {
  drivers_license: {
    type: 'drivers_license',
    label: "Driver's License",
    cost: 'No cost',
    uploadable: true,
    requiresExpiration: true,
    validityYears: 4,
  },
  ssn_card: {
    type: 'ssn_card',
    label: 'SSN Card',
    cost: 'No cost',
    uploadable: true,
    description: 'Upload a copy of your Social Security card for identity verification.',
  },
  birth_certificate_passport: {
    type: 'birth_certificate_passport',
    label: 'Birth Certificate / Passport',
    cost: 'No cost',
    uploadable: true,
    description: 'Upload a copy of your birth certificate or passport for identity verification.',
  },
  proof_of_insurance: {
    type: 'proof_of_insurance',
    label: 'Proof of Insurance',
    cost: 'No cost',
    uploadable: true,
    requiresExpiration: true,
    validityYears: 1,
  },
  vehicle_registration: {
    type: 'vehicle_registration',
    label: 'Vehicle Registration',
    cost: 'No cost',
    uploadable: true,
    requiresExpiration: true,
    validityYears: 2,
  },
  vehicle_inspection: {
    type: 'vehicle_inspection',
    label: 'Vehicle Inspection by a certified mechanic',
    cost: 'Driver is responsible for the cost',
    uploadable: true,
    requiresExpiration: true,
  },
  english_language_proficiency: {
    type: 'english_language_proficiency',
    label: 'English Language Proficiency (Hallo.ai)',
    cost: 'No cost',
    uploadable: true,
    specialNote: 'Complete on Hallo.ai and upload certificate',
  },
  background_check_fingerprinting: {
    type: 'background_check_fingerprinting',
    label: 'Background Check & Fingerprinting',
    cost: 'No cost',
    uploadable: false,
    actionLabel: 'Request / View Status',
  },
  drug_test: {
    type: 'drug_test',
    label: 'Drug Test',
    cost: 'No cost (scheduled through Checkers)',
    uploadable: true,
    specialNote: 'Upload results when received',
  },
  driving_record: {
    type: 'driving_record',
    label: 'Driving Record (MVR)',
    cost: 'Driver may be responsible for the cost',
    uploadable: true,
    requiresExpiration: true,
    validityYears: 1,
    description: 'Upload a current motor vehicle record from your state DMV.',
  },
  saferide_course: {
    type: 'saferide_course',
    label: 'SafeRide Course',
    cost: '$25 (paid by you)',
    uploadable: true,
    description:
      'You must complete the SafeRide training course before driving.\nCost: $25 (paid by you)\n\nHow to complete:\nGo to https://everdriven.talentlms.com/\nClick Signup in the upper right.\nCreate your account and log in.\nClick Get your first course.\nSelect the course that matches your language and vehicle type.\n\nNote: The wheelchair accessible vehicle course also covers non-wheelchair vehicles (it just has one extra module).',
    specialNote: 'Upload your completion certificate after finishing the course on TalentLMS.',
  },
  dot_physical: {
    type: 'dot_physical',
    label: 'DOT Physical Examination',
    cost: 'Driver is responsible for the cost',
    validityYears: 2,
    uploadable: true,
    requiresExpiration: true,
  },
  accident_prevention_course: {
    type: 'accident_prevention_course',
    label: 'Vehicle Accident Prevention Course',
    cost: 'Typically $20–$30 (paid by you)',
    validityYears: 3,
    uploadable: true,
    requiresExpiration: true,
    description: DEFAULT_ACCIDENT_PREVENTION_COURSE_DESCRIPTION,
    specialNote:
      'Kansas drivers: see K.A.R. 91-38-6 details and approved provider links on this card.',
  },
  tb_test: {
    type: 'tb_test',
    label: 'TB Test Results (Good for 4 years)',
    cost: 'Driver is responsible for the cost',
    description:
      'Please upload a copy of TB Test results. The test must be completed within 90 days and renewed every 4 years. Go to a local health facility to have a TB skin test performed. You are required to pay for this test.',
    validityMonths: 48,
    validityYears: 4,
    uploadable: true,
    requiresExpiration: true,
  },
  cpr_training: {
    type: 'cpr_training',
    label: 'CPR Training Record',
    cost: 'Driver is responsible for the cost',
    validityYears: 2,
    uploadable: true,
    requiresExpiration: true,
  },
  first_aid_training: {
    type: 'first_aid_training',
    label: 'First Aid Training Record',
    cost: 'Driver is responsible for the cost',
    validityYears: 2,
    uploadable: true,
    requiresExpiration: true,
  },
  defensive_driving: {
    type: 'defensive_driving',
    label: 'Defensive Driving Course',
    cost: 'Driver is responsible for the cost',
    validityYears: 2,
    uploadable: true,
    requiresExpiration: true,
  },
  child_seat_training: {
    type: 'child_seat_training',
    label: 'Child Seat Training',
    cost: 'Driver is responsible for the cost',
    uploadable: true,
    requiresExpiration: true,
    validityYears: 2,
    description: 'Upload proof of child passenger safety / car seat installation training.',
  },
  safety_meetings: {
    type: 'safety_meetings',
    label: 'Safety Meetings / Safety Rosters',
    cost: 'No cost',
    uploadable: true,
    specialNote: 'You may upload multiple files',
  },
};

export function getCatalogDocument(type: string): RequiredDocument | undefined {
  return DRIVER_DOCUMENT_CATALOG[type];
}