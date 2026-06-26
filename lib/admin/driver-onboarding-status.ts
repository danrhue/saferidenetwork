import type { SupabaseClient } from '@supabase/supabase-js';
import {
  countApprovedRequiredDocuments,
  countRequiredUploadSlots,
} from '@/lib/driver/document-completion';
import { getDocumentDisplayLabel } from '@/lib/driver/document-display';
import { isDocumentExpired } from '@/lib/driver/document-expiration';
import type { PersonalProfile } from '@/lib/driver/onboarding-completion';
import { calculateDriverOverviewStats } from '@/lib/driver/pending-tasks';
import {
  buildDocumentCompletionContext,
  getDriverCompletionPercent,
  isDriverProfileComplete,
} from '@/lib/driver/profile-completion';
import { findDriverDocument, type RequiredDocument } from '@/lib/driver/required-documents';
import {
  resolveRequiredDocumentsForStates,
  type StateRequirementRow,
} from '@/lib/driver/resolve-driver-documents';
import {
  isProfilePhotoApproved,
  normalizeProfilePhotoStatus,
  profilePhotoStatusLabel,
} from '@/lib/profile-photo';
import { getWizardStepCompletionMap, WIZARD_STEPS } from '@/lib/driver/wizard-steps';
import { normalizeStateCodes } from '@/lib/driver/us-states';

const HIGHLIGHT_COMPLIANCE_DOC_TYPES = ['first_aid_cpr_aed', 'first_aid_training'] as const;

export type AdminOnboardingStep = {
  id: number;
  title: string;
  complete: boolean;
};

export type AdminComplianceItemStatus =
  | 'complete'
  | 'pending'
  | 'incomplete'
  | 'rejected'
  | 'optional';

export type AdminComplianceItem = {
  id: string;
  label: string;
  status: AdminComplianceItemStatus;
  detail: string;
};

export type AdminDriverOnboardingStatus = {
  completionPercent: number;
  isProfileComplete: boolean;
  steps: AdminOnboardingStep[];
  complianceItems: AdminComplianceItem[];
  documentsApproved: number;
  documentsRequired: number;
  accountStatusLabel: string;
  accountStatusTone: 'green' | 'yellow' | 'red';
};

type DocumentRow = {
  document_type: string;
  status: string;
  expires_at?: string | null;
};

export async function loadRequiredDocumentsForDriver(
  admin: SupabaseClient,
  drivingStates: string[] | null | undefined
): Promise<RequiredDocument[]> {
  const states = normalizeStateCodes(drivingStates ?? undefined);
  if (states.length === 0) return [];

  const { data: rows, error } = await admin
    .from('state_document_requirements')
    .select('state_code, document_type, sort_order, is_required')
    .in('state_code', states)
    .eq('is_required', true)
    .order('sort_order', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return resolveRequiredDocumentsForStates(states, (rows ?? []) as StateRequirementRow[]);
}

function resolveDocumentCompliance(
  docType: string,
  documents: DocumentRow[],
  requiredDocuments: RequiredDocument[]
): AdminComplianceItem | null {
  const required = requiredDocuments.find((doc) => doc.type === docType);
  if (!required) return null;

  const existing = findDriverDocument(documents, docType);
  const label = getDocumentDisplayLabel(docType);

  if (!existing) {
    return { id: docType, label, status: 'incomplete', detail: 'Not uploaded' };
  }
  if (existing.status === 'rejected') {
    return { id: docType, label, status: 'rejected', detail: 'Rejected — needs re-upload' };
  }
  if (isDocumentExpired(existing.expires_at)) {
    return { id: docType, label, status: 'incomplete', detail: 'Expired — needs updated upload' };
  }
  if (existing.status === 'approved') {
    return { id: docType, label, status: 'complete', detail: 'Approved' };
  }
  return { id: docType, label, status: 'pending', detail: 'Uploaded — pending review' };
}

function buildComplianceItems(
  profile: PersonalProfile,
  documents: DocumentRow[],
  requiredDocuments: RequiredDocument[],
  docCtx: ReturnType<typeof buildDocumentCompletionContext>
): AdminComplianceItem[] {
  const items: AdminComplianceItem[] = [];
  const documentsApproved = countApprovedRequiredDocuments(documents, requiredDocuments);
  const documentsRequired = countRequiredUploadSlots(requiredDocuments);

  if (documentsRequired === 0) {
    items.push({
      id: 'documents',
      label: 'Required documents',
      status: 'incomplete',
      detail: 'No operating states selected',
    });
  } else if (documentsApproved >= documentsRequired) {
    items.push({
      id: 'documents',
      label: 'Required documents',
      status: 'complete',
      detail: `${documentsApproved} of ${documentsRequired} approved`,
    });
  } else {
    const uploaded = docCtx.documentsUploaded;
    let status: AdminComplianceItemStatus = 'incomplete';
    let detail = `${documentsApproved} of ${documentsRequired} approved`;

    if (uploaded >= documentsRequired && documentsApproved < documentsRequired) {
      status = 'pending';
      detail = `${documentsApproved} of ${documentsRequired} approved — reviews pending`;
    } else if (uploaded < documentsRequired) {
      detail = `${documentsApproved} of ${documentsRequired} approved — ${documentsRequired - uploaded} not uploaded`;
    }

    items.push({
      id: 'documents',
      label: 'Required documents',
      status,
      detail,
    });
  }

  const photoStatus = normalizeProfilePhotoStatus(
    profile.profile_photo_status as string | null | undefined
  );
  if (isProfilePhotoApproved(profile)) {
    items.push({
      id: 'profile-photo',
      label: 'Profile photo',
      status: 'complete',
      detail: 'Approved',
    });
  } else if (photoStatus === 'pending' && profile.profile_photo_url) {
    items.push({
      id: 'profile-photo',
      label: 'Profile photo',
      status: 'pending',
      detail: 'Uploaded — pending review',
    });
  } else if (photoStatus === 'rejected') {
    items.push({
      id: 'profile-photo',
      label: 'Profile photo',
      status: 'rejected',
      detail: 'Rejected — driver must re-upload',
    });
  } else {
    items.push({
      id: 'profile-photo',
      label: 'Profile photo',
      status: 'incomplete',
      detail: profilePhotoStatusLabel(photoStatus),
    });
  }

  for (const docType of HIGHLIGHT_COMPLIANCE_DOC_TYPES) {
    const item = resolveDocumentCompliance(docType, documents, requiredDocuments);
    if (item) items.push(item);
  }

  const seatingStatus = (profile.seating_approval_status as string | undefined) ?? 'approved';
  const hasVehicle =
    profile.vehicle_year &&
    profile.vehicle_make &&
    profile.vehicle_model &&
    profile.passenger_capacity;

  if (!hasVehicle) {
    items.push({
      id: 'vehicle',
      label: 'Vehicle & seating',
      status: 'incomplete',
      detail: 'Vehicle details incomplete',
    });
  } else if (seatingStatus === 'pending') {
    items.push({
      id: 'vehicle',
      label: 'Vehicle & seating',
      status: 'pending',
      detail: 'Seating capacity override pending admin approval',
    });
  } else if (seatingStatus === 'rejected') {
    items.push({
      id: 'vehicle',
      label: 'Vehicle & seating',
      status: 'rejected',
      detail: 'Seating capacity override rejected',
    });
  } else {
    items.push({
      id: 'vehicle',
      label: 'Vehicle & seating',
      status: 'complete',
      detail: 'Vehicle on file',
    });
  }

  const stripeReady =
    profile.stripe_account_id &&
    profile.stripe_onboarding_complete &&
    profile.stripe_payouts_enabled;

  items.push({
    id: 'stripe-payouts',
    label: 'Stripe payouts',
    status: stripeReady ? 'complete' : 'optional',
    detail: stripeReady
      ? 'Payout account connected'
      : 'Not connected — optional until first payout',
  });

  items.push({
    id: 'marketplace-ready',
    label: 'Marketplace eligible',
    status: isDriverProfileComplete(profile, docCtx) ? 'complete' : 'incomplete',
    detail: isDriverProfileComplete(profile, docCtx)
      ? 'Profile 100% complete — can submit trip offers'
      : 'Profile incomplete — cannot submit trip offers yet',
  });

  return items;
}

export function buildAdminDriverOnboardingStatus(
  profile: PersonalProfile,
  documents: DocumentRow[],
  requiredDocuments: RequiredDocument[]
): AdminDriverOnboardingStatus {
  const docCtx = buildDocumentCompletionContext(documents, requiredDocuments);
  const completionPercent = getDriverCompletionPercent(profile, docCtx);
  const stepCompletion = getWizardStepCompletionMap(profile, docCtx);

  const steps = WIZARD_STEPS.map((step, index) => ({
    id: step.id,
    title: step.title,
    complete: stepCompletion[index] ?? false,
  }));

  const stats = calculateDriverOverviewStats(
    profile,
    documents,
    completionPercent,
    requiredDocuments
  );

  return {
    completionPercent,
    isProfileComplete: isDriverProfileComplete(profile, docCtx),
    steps,
    complianceItems: buildComplianceItems(profile, documents, requiredDocuments, docCtx),
    documentsApproved: stats.documentsApproved,
    documentsRequired: stats.documentsRequired,
    accountStatusLabel: stats.accountStatusLabel,
    accountStatusTone: stats.accountStatusTone,
  };
}