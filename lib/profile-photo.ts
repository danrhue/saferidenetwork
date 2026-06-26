export type ProfilePhotoStatus = 'pending' | 'approved' | 'rejected';

export type ProfilePhotoFields = {
  profile_photo_url?: string | null;
  profile_photo_status?: string | null;
  profile_photo_rejection_reason?: string | null;
};

export const PROFILE_PHOTO_GUIDELINES = [
  'Use a recent, clear photo of your face (head and shoulders).',
  'Face the camera directly with good, even lighting.',
  'No sunglasses, hats, or face coverings.',
  'Plain background preferred — avoid group photos or filters.',
  'JPG or PNG only, maximum 5 MB.',
] as const;

export function normalizeProfilePhotoStatus(
  status: string | null | undefined
): ProfilePhotoStatus | null {
  if (status === 'pending' || status === 'approved' || status === 'rejected') {
    return status;
  }
  return null;
}

/** Storage path visible to the viewer (owners always see their upload; others only when approved). */
export function getVisibleProfilePhotoPath(
  profile: ProfilePhotoFields,
  options?: { isOwner?: boolean }
): string | null {
  if (!profile.profile_photo_url) return null;
  if (options?.isOwner) return profile.profile_photo_url;
  if (profile.profile_photo_status === 'approved') return profile.profile_photo_url;
  return null;
}

export function isProfilePhotoApproved(profile: ProfilePhotoFields): boolean {
  return Boolean(
    profile.profile_photo_url && profile.profile_photo_status === 'approved'
  );
}

/** Onboarding counts uploaded photos as complete, including those awaiting admin review. */
export function hasProfilePhotoForOnboarding(profile: ProfilePhotoFields): boolean {
  if (!profile.profile_photo_url) return false;
  const status = normalizeProfilePhotoStatus(profile.profile_photo_status ?? null);
  return status === 'pending' || status === 'approved';
}

export function profilePhotoStatusLabel(status: ProfilePhotoStatus | null): string {
  switch (status) {
    case 'pending':
      return 'Pending Review';
    case 'approved':
      return 'Approved';
    case 'rejected':
      return 'Rejected';
    default:
      return 'Not Uploaded';
  }
}

export function profilePhotoStatusBadgeClass(status: ProfilePhotoStatus | null): string {
  switch (status) {
    case 'pending':
      return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'approved':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'rejected':
      return 'bg-red-100 text-red-800 border-red-200';
    default:
      return 'bg-gray-100 text-gray-600 border-gray-200';
  }
}