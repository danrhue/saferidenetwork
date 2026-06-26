import { hasProfilePhotoForOnboarding } from '@/lib/profile-photo';

export type PersonalProfile = Record<string, unknown>;

function hasValue(profile: PersonalProfile, field: string): boolean {
  const value = profile[field];
  if (value == null || value === '') return false;
  if (typeof value === 'string') return value.trim().length > 0;
  return true;
}

export function calculateDriverCompletion(
  profile: PersonalProfile,
  options: {
    documentsUploaded: number;
    documentsRequired: number;
  }
): number {
  const mailingOk =
    profile.mailing_same_as_physical !== false ||
    (hasValue(profile, 'mailing_address_line1') && hasValue(profile, 'mailing_city'));

  const checks = [
    hasValue(profile, 'first_name') &&
      hasValue(profile, 'last_name') &&
      hasValue(profile, 'email') &&
      hasValue(profile, 'phone'),
    hasValue(profile, 'physical_address_line1') &&
      hasValue(profile, 'physical_city') &&
      hasValue(profile, 'physical_state') &&
      mailingOk,
    hasValue(profile, 'drivers_license_number') && hasValue(profile, 'drivers_license_state'),
    hasValue(profile, 'dob_year') && hasValue(profile, 'ssn'),
    hasValue(profile, 'emergency_contact_first_name') &&
      hasValue(profile, 'emergency_contact_phone'),
    hasProfilePhotoForOnboarding(profile),
    !!(
      profile.vehicle_year &&
      profile.vehicle_make &&
      profile.vehicle_model &&
      profile.passenger_capacity
    ),
    !!(
      profile.stripe_account_id &&
      profile.stripe_onboarding_complete &&
      profile.stripe_payouts_enabled
    ),
    options.documentsRequired > 0 &&
      options.documentsUploaded >= options.documentsRequired,
  ];

  const filled = checks.filter(Boolean).length;
  return Math.round((filled / checks.length) * 100);
}