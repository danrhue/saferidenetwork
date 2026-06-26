import { findDriverDocument, type RequiredDocument } from '@/lib/driver/required-documents';
import type { PersonalProfile } from '@/lib/driver/onboarding-completion';
import {
  isPersonalDetailsStepComplete,
  isWizardStepComplete,
} from '@/lib/driver/wizard-step-completion';
import { PROFILE_WIZARD_PATH } from '@/lib/driver/wizard-steps';
import type { WizardCompletionContext } from '@/lib/driver/wizard-steps';
import { normalizeProfilePhotoStatus } from '@/lib/profile-photo';
import { normalizeStateCodes } from '@/lib/driver/us-states';

export type IncompleteOfferRequirement = {
  id: string;
  label: string;
  status: string;
  href: string;
  wizardStep?: number;
};

type DriverDocumentRecord = {
  document_type: string;
  status?: string;
};

function wizardHref(step: number): string {
  return `${PROFILE_WIZARD_PATH}?step=${step}`;
}

function hasValue(profile: PersonalProfile, field: string): boolean {
  const value = profile[field];
  if (value == null || value === '') return false;
  if (typeof value === 'string') return value.trim().length > 0;
  return true;
}

function pushRequirement(
  list: IncompleteOfferRequirement[],
  item: IncompleteOfferRequirement
): void {
  list.push(item);
}

/** Detailed, driver-friendly list of what still blocks trip offers. */
export function getIncompleteOfferRequirements(
  profile: PersonalProfile,
  docCtx: WizardCompletionContext,
  options?: {
    requiredDocuments?: RequiredDocument[];
    driverDocuments?: DriverDocumentRecord[];
  }
): IncompleteOfferRequirement[] {
  const requirements: IncompleteOfferRequirement[] = [];
  const requiredDocuments = options?.requiredDocuments ?? [];
  const driverDocuments = options?.driverDocuments ?? [];

  if (!isWizardStepComplete(1, profile, docCtx)) {
    const missing: string[] = [];
    if (!hasValue(profile, 'first_name')) missing.push('first name');
    if (!hasValue(profile, 'last_name')) missing.push('last name');
    if (!hasValue(profile, 'email')) missing.push('email');
    if (!hasValue(profile, 'phone')) missing.push('phone');
    if (!hasValue(profile, 'phone_type')) missing.push('phone type');

    pushRequirement(requirements, {
      id: 'personal-info',
      label: 'Personal information',
      status: missing.length > 0 ? `Missing: ${missing.join(', ')}` : 'Incomplete',
      href: wizardHref(1),
      wizardStep: 1,
    });
  }

  if (!isWizardStepComplete(2, profile, docCtx)) {
    pushRequirement(requirements, {
      id: 'operating-states',
      label: 'Operating states',
      status: 'Select at least one state where you plan to drive',
      href: wizardHref(2),
      wizardStep: 2,
    });
  }

  if (!isWizardStepComplete(3, profile, docCtx)) {
    pushRequirement(requirements, {
      id: 'addresses',
      label: 'Physical & mailing addresses',
      status: 'Complete your home and mailing addresses',
      href: wizardHref(3),
      wizardStep: 3,
    });
  }

  if (!isWizardStepComplete(4, profile, docCtx)) {
    const month = Number(profile.drivers_license_exp_month);
    const day = Number(profile.drivers_license_exp_day);
    const year = Number(profile.drivers_license_exp_year);
    let status = 'Add license number, state, and expiration date';
    if (
      hasValue(profile, 'drivers_license_number') &&
      hasValue(profile, 'drivers_license_state') &&
      Number.isFinite(month) &&
      Number.isFinite(day) &&
      Number.isFinite(year)
    ) {
      status = 'License expiration must be a future date';
    }

    pushRequirement(requirements, {
      id: 'drivers-license',
      label: "Driver's license",
      status,
      href: wizardHref(4),
      wizardStep: 4,
    });
  }

  if (!isWizardStepComplete(5, profile, docCtx)) {
    pushRequirement(requirements, {
      id: 'personal-details',
      label: 'Personal details',
      status: isPersonalDetailsStepComplete(profile)
        ? 'Incomplete'
        : 'Date of birth, SSN, and physical description required',
      href: wizardHref(5),
      wizardStep: 5,
    });
  }

  if (!isWizardStepComplete(6, profile, docCtx)) {
    pushRequirement(requirements, {
      id: 'emergency-contact',
      label: 'Emergency contact',
      status: 'Add emergency contact name, phone, and relationship',
      href: wizardHref(6),
      wizardStep: 6,
    });
  }

  if (!isWizardStepComplete(7, profile, docCtx)) {
    const photoStatus = normalizeProfilePhotoStatus(
      profile.profile_photo_status as string | null | undefined
    );
    let status = 'Not uploaded';
    if (photoStatus === 'rejected') {
      status = 'Rejected — upload a new photo';
    } else if (profile.profile_photo_url && photoStatus === 'pending') {
      status = 'Pending review';
    }

    pushRequirement(requirements, {
      id: 'profile-photo',
      label: 'Profile photo',
      status,
      href: wizardHref(7),
      wizardStep: 7,
    });
  }

  if (!isWizardStepComplete(8, profile, docCtx)) {
    const seatingStatus = profile.seating_approval_status as string | undefined;
    let status = 'Add vehicle year, make, model, and passenger capacity';
    if (
      profile.vehicle_year &&
      profile.vehicle_make &&
      profile.vehicle_model &&
      profile.passenger_capacity &&
      seatingStatus === 'pending'
    ) {
      status = 'Seating capacity override pending admin approval';
    } else if (seatingStatus === 'rejected') {
      status = 'Seating capacity override rejected — update vehicle details';
    }

    pushRequirement(requirements, {
      id: 'vehicle',
      label: 'Vehicle & seating',
      status,
      href: wizardHref(8),
      wizardStep: 8,
    });
  }

  if (!isWizardStepComplete(9, profile, docCtx)) {
    const drivingStates = normalizeStateCodes(profile.driving_states as string[] | undefined);

    if (drivingStates.length === 0) {
      pushRequirement(requirements, {
        id: 'documents-states',
        label: 'Required documents',
        status: 'Select operating states first to see document requirements',
        href: wizardHref(2),
        wizardStep: 2,
      });
    } else {
      const uploadableRequired = requiredDocuments.filter((d) => d.uploadable);

      if (uploadableRequired.length === 0) {
        pushRequirement(requirements, {
          id: 'documents',
          label: 'Required documents',
          status: 'No uploadable documents configured for your states',
          href: '/dashboard/documents',
          wizardStep: 9,
        });
      } else {
        let addedMissingDocument = false;
        for (const doc of uploadableRequired) {
          const existing = findDriverDocument(driverDocuments, doc.type);
          if (existing) continue;

          addedMissingDocument = true;
          pushRequirement(requirements, {
            id: `document-${doc.type}`,
            label: doc.label,
            status: 'Not uploaded',
            href: `/dashboard/documents#doc-${doc.type}`,
            wizardStep: 9,
          });
        }

        if (!addedMissingDocument) {
          pushRequirement(requirements, {
            id: 'documents',
            label: 'Required documents',
            status: 'Upload all required compliance documents',
            href: '/dashboard/documents',
            wizardStep: 9,
          });
        }
      }
    }
  }

  return requirements;
}