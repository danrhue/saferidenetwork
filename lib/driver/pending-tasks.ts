import { isDocumentExpired } from '@/lib/driver/document-expiration';
import {
  findDriverDocument,
  type RequiredDocument,
} from '@/lib/driver/required-documents';
import type { PersonalProfile } from '@/lib/driver/onboarding-completion';
import { isPersonalDetailsStepComplete } from '@/lib/driver/wizard-step-completion';
import { PROFILE_WIZARD_PATH } from '@/lib/driver/wizard-steps';
import { normalizeStateCodes } from '@/lib/driver/us-states';

export type DriverDocumentRecord = {
  id?: string;
  document_type: string;
  status: string;
  expires_at?: string | null;
  rejection_reason?: string | null;
  uploaded_at?: string;
};

/** Profile wizard entry — smart resume picks the right step (no hardcoded ?step=). */
export const PROFILE_WIZARD_HREF = PROFILE_WIZARD_PATH;

export type PendingTaskKind = 'document' | 'profile';

export type PendingTaskPriority = 'high' | 'medium' | 'low';

export type PendingTask = {
  id: string;
  kind: PendingTaskKind;
  priority: PendingTaskPriority;
  title: string;
  description: string;
  actionLabel: string;
  href: string;
  documentType?: string;
};

export type DriverOverviewStats = {
  documentsUploaded: number;
  documentsRequired: number;
  documentsApproved: number;
  documentsPending: number;
  profileCompletion: number;
  pendingTaskCount: number;
  accountStatusLabel: string;
  accountStatusTone: 'green' | 'yellow' | 'red';
};

function hasValue(profile: PersonalProfile, field: string): boolean {
  const value = profile[field];
  if (value == null || value === '') return false;
  if (typeof value === 'string') return value.trim().length > 0;
  return true;
}

function mailingAddressComplete(profile: PersonalProfile): boolean {
  if (profile.mailing_same_as_physical !== false) return true;
  return hasValue(profile, 'mailing_address_line1') && hasValue(profile, 'mailing_city');
}

function documentNeedsAction(
  docDef: RequiredDocument,
  existing: DriverDocumentRecord | undefined
): { needsAction: boolean; reason: string; actionLabel: string; priority: PendingTaskPriority } {
  if (!docDef.uploadable) {
    if (!existing || existing.status !== 'approved') {
      return {
        needsAction: true,
        reason: 'Complete this requirement with SafeRide support.',
        actionLabel: docDef.actionLabel || 'View Status',
        priority: 'medium',
      };
    }
    return { needsAction: false, reason: '', actionLabel: '', priority: 'low' };
  }

  if (!existing) {
    return {
      needsAction: true,
      reason: 'Required for account activation.',
      actionLabel: 'Upload',
      priority: 'high',
    };
  }

  if (existing.status === 'approved' && !isDocumentExpired(existing.expires_at)) {
    return { needsAction: false, reason: '', actionLabel: '', priority: 'low' };
  }

  if (
    ['pending_review', 'uploaded'].includes(existing.status) &&
    !isDocumentExpired(existing.expires_at)
  ) {
    return { needsAction: false, reason: '', actionLabel: '', priority: 'low' };
  }

  if (isDocumentExpired(existing.expires_at) || existing.status === 'rejected') {
    const reason =
      existing.rejection_reason ||
      (isDocumentExpired(existing.expires_at)
        ? 'This document has expired. Upload an updated version.'
        : 'This document was rejected. Upload a corrected version.');
    return {
      needsAction: true,
      reason,
      actionLabel: 'Re-upload',
      priority: 'high',
    };
  }

  return {
    needsAction: true,
    reason: 'Upload this document to continue onboarding.',
    actionLabel: 'Upload',
    priority: 'medium',
  };
}

function getProfileDrivingStates(profile: PersonalProfile): string[] {
  const raw = profile.driving_states;
  if (!Array.isArray(raw)) return [];
  return normalizeStateCodes(raw as string[]);
}

function buildDocumentTasks(
  documents: DriverDocumentRecord[],
  requiredDocuments: RequiredDocument[]
): PendingTask[] {
  const tasks: PendingTask[] = [];

  for (const docDef of requiredDocuments) {
    const existing = findDriverDocument(documents, docDef.type);
    const { needsAction, reason, actionLabel, priority } = documentNeedsAction(docDef, existing);

    if (!needsAction) continue;

    tasks.push({
      id: `document-${docDef.type}`,
      kind: 'document',
      priority,
      title: docDef.uploadable ? `Upload ${docDef.label}` : docDef.label,
      description: reason,
      actionLabel,
      href: docDef.uploadable
        ? `/dashboard/documents#doc-${docDef.type}`
        : '/dashboard/documents#doc-background_check_fingerprinting',
      documentType: docDef.type,
    });
  }

  return tasks;
}

function buildProfileTasks(profile: PersonalProfile): PendingTask[] {
  const tasks: PendingTask[] = [];

  const addTask = (
    id: string,
    title: string,
    description: string,
    href: string,
    priority: PendingTaskPriority = 'medium'
  ) => {
    tasks.push({
      id,
      kind: 'profile',
      priority,
      title,
      description,
      actionLabel: 'Complete',
      href,
    });
  };

  if (getProfileDrivingStates(profile).length === 0) {
    addTask(
      'profile-driving-states',
      'Select operating states',
      'Choose the state(s) where you plan to drive so we can show the correct required documents.',
      PROFILE_WIZARD_HREF,
      'high'
    );
  }

  if (
    !hasValue(profile, 'first_name') ||
    !hasValue(profile, 'last_name') ||
    !hasValue(profile, 'email') ||
    !hasValue(profile, 'phone')
  ) {
    addTask(
      'profile-personal',
      'Complete personal information',
      'Add your name, email, and phone number.',
      PROFILE_WIZARD_HREF
    );
  }

  if (
    !hasValue(profile, 'physical_address_line1') ||
    !hasValue(profile, 'physical_city') ||
    !hasValue(profile, 'physical_state') ||
    !mailingAddressComplete(profile)
  ) {
    addTask(
      'profile-address',
      'Complete your addresses',
      'Add your physical address and mailing address if different.',
      PROFILE_WIZARD_HREF
    );
  }

  if (!hasValue(profile, 'drivers_license_number') || !hasValue(profile, 'drivers_license_state')) {
    addTask(
      'profile-license',
      "Add driver's license details",
      'Enter your license number and issuing state on your profile.',
      PROFILE_WIZARD_HREF
    );
  }

  if (!isPersonalDetailsStepComplete(profile)) {
    addTask(
      'profile-details',
      'Complete personal details',
      'Date of birth, SSN, and personal attributes are required for verification.',
      PROFILE_WIZARD_HREF
    );
  }

  if (
    !hasValue(profile, 'emergency_contact_first_name') ||
    !hasValue(profile, 'emergency_contact_phone')
  ) {
    addTask(
      'profile-emergency',
      'Add emergency contact',
      'Provide an emergency contact name and phone number.',
      PROFILE_WIZARD_HREF
    );
  }

  if (!profile.profile_photo_url) {
    addTask(
      'profile-photo',
      'Upload profile photo',
      'A profile photo helps organizations recognize you.',
      PROFILE_WIZARD_HREF,
      'low'
    );
  } else if (profile.profile_photo_status === 'rejected') {
    addTask(
      'profile-photo-rejected',
      'Re-upload profile photo',
      profile.profile_photo_rejection_reason
        ? `Rejected: ${profile.profile_photo_rejection_reason}`
        : 'Your profile photo was rejected. Please upload a new one.',
      '/dashboard',
      'medium'
    );
  }

  if (
    !profile.vehicle_year ||
    !profile.vehicle_make ||
    !profile.vehicle_model ||
    !profile.passenger_capacity
  ) {
    addTask(
      'profile-vehicle',
      'Complete vehicle information',
      'Add your vehicle year, make, model, and passenger capacity.',
      PROFILE_WIZARD_HREF
    );
  }

  if (
    !profile.stripe_account_id ||
    !profile.stripe_onboarding_complete ||
    !profile.stripe_payouts_enabled
  ) {
    addTask(
      'profile-payouts',
      'Set up payout account',
      'Connect Stripe to receive trip payouts.',
      PROFILE_WIZARD_HREF,
      'high'
    );
  }

  return tasks;
}

const PRIORITY_ORDER: Record<PendingTaskPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export function calculatePendingTasks(
  profile: PersonalProfile,
  documents: DriverDocumentRecord[],
  requiredDocuments: RequiredDocument[]
): PendingTask[] {
  const profileTasks = buildProfileTasks(profile);
  const documentTasks =
    getProfileDrivingStates(profile).length > 0
      ? buildDocumentTasks(documents, requiredDocuments)
      : [];

  const tasks = [...profileTasks, ...documentTasks];

  return tasks.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
}

export function calculateDriverOverviewStats(
  profile: PersonalProfile,
  documents: DriverDocumentRecord[],
  profileCompletion: number,
  requiredDocuments: RequiredDocument[]
): DriverOverviewStats {
  const uploadableRequired = requiredDocuments.filter((d) => d.uploadable);
  const uploadedTypes = new Set(documents.map((d) => d.document_type));
  const approvedTypes = new Set(
    documents
      .filter((d) => d.status === 'approved' && !isDocumentExpired(d.expires_at))
      .map((d) => d.document_type)
  );

  const pendingTasks = calculatePendingTasks(profile, documents, requiredDocuments);
  const documentsStillNeeded = uploadableRequired.filter((docDef) => {
    const existing = findDriverDocument(documents, docDef.type);
    const { needsAction } = documentNeedsAction(docDef, existing);
    return needsAction;
  }).length;

  let accountStatusLabel = 'Active';
  let accountStatusTone: DriverOverviewStats['accountStatusTone'] = 'green';

  if (pendingTasks.some((t) => t.priority === 'high')) {
    accountStatusLabel = 'Action required';
    accountStatusTone = 'yellow';
  } else if (pendingTasks.length > 0) {
    accountStatusLabel = 'Almost ready';
    accountStatusTone = 'yellow';
  } else if (profileCompletion < 100) {
    accountStatusLabel = 'In progress';
    accountStatusTone = 'yellow';
  }

  return {
    documentsUploaded: uploadedTypes.size,
    documentsRequired: uploadableRequired.length,
    documentsApproved: approvedTypes.size,
    documentsPending: documentsStillNeeded,
    profileCompletion,
    pendingTaskCount: pendingTasks.length,
    accountStatusLabel,
    accountStatusTone,
  };
}