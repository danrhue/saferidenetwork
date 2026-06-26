import type { SupabaseClient } from '@supabase/supabase-js';
import {
  removeProfilePhoto,
  resolveProfilePhotoForProfile,
  uploadProfilePhoto,
} from '@/lib/storage/profile-photos';

const MAX_PHOTO_SIZE = 5 * 1024 * 1024;

export type ProfilePhotoUploadResult = {
  path: string;
  photoUrl: string | null;
};

export function validateProfilePhotoFile(file: File): string | null {
  if (file.size > MAX_PHOTO_SIZE) return 'Photo too large. Max 5MB.';
  if (!['image/jpeg', 'image/png'].includes(file.type)) {
    return 'Please upload JPG or PNG only.';
  }
  return null;
}

export async function submitDriverProfilePhoto(
  supabase: SupabaseClient,
  userId: string,
  file: File
): Promise<ProfilePhotoUploadResult> {
  const validationError = validateProfilePhotoFile(file);
  if (validationError) throw new Error(validationError);

  const { path, error: upErr } = await uploadProfilePhoto(supabase, userId, file);
  if (upErr) throw upErr;

  const { error: dbErr } = await supabase
    .from('profiles')
    .update({
      profile_photo_url: path,
      profile_photo_status: 'pending',
      profile_photo_rejection_reason: null,
      profile_photo_last_reviewed_at: null,
      profile_photo_last_reviewed_by: null,
    })
    .eq('id', userId);

  if (dbErr) throw dbErr;

  const photoUrl = await resolveProfilePhotoForProfile(
    supabase,
    { profile_photo_url: path, profile_photo_status: 'pending' },
    { isOwner: true }
  );

  return { path, photoUrl };
}

export async function deleteDriverProfilePhoto(
  supabase: SupabaseClient,
  userId: string,
  storagePath: string
): Promise<void> {
  await removeProfilePhoto(supabase, storagePath);
  const { error } = await supabase
    .from('profiles')
    .update({
      profile_photo_url: null,
      profile_photo_status: null,
      profile_photo_rejection_reason: null,
      profile_photo_last_reviewed_at: null,
      profile_photo_last_reviewed_by: null,
    })
    .eq('id', userId);

  if (error) throw error;
}