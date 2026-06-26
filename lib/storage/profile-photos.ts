import type { SupabaseClient } from '@supabase/supabase-js';
import { getVisibleProfilePhotoPath, type ProfilePhotoFields } from '@/lib/profile-photo';

/** Supabase storage bucket for driver profile headshots (public). */
export const PROFILE_PHOTOS_BUCKET = 'profile-photos';

/** Legacy bucket — used as fallback when reading older profile_photo_url paths. */
export const LEGACY_PROFILE_PHOTOS_BUCKET = 'driver-photos';

const SIGNED_URL_TTL_SECONDS = 3600;

export function buildProfilePhotoStoragePath(userId: string, file: File): string {
  const ext = file.type === 'image/png' ? 'png' : 'jpg';
  return `${userId}/profile.${ext}`;
}

export function getProfilePhotoPublicUrl(storagePath: string | null | undefined): string | null {
  if (!storagePath) return null;
  if (storagePath.startsWith('http://') || storagePath.startsWith('https://')) {
    return storagePath;
  }

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;

  return `${base}/storage/v1/object/public/${PROFILE_PHOTOS_BUCKET}/${storagePath}`;
}

export async function uploadProfilePhoto(
  supabase: SupabaseClient,
  userId: string,
  file: File
): Promise<{ path: string; error: Error | null }> {
  const path = buildProfilePhotoStoragePath(userId, file);

  const { error } = await supabase.storage.from(PROFILE_PHOTOS_BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type || undefined,
    cacheControl: '3600',
  });

  return {
    path,
    error: error ? new Error(error.message) : null,
  };
}

export async function removeProfilePhoto(
  supabase: SupabaseClient,
  storagePath: string
): Promise<void> {
  const buckets = [PROFILE_PHOTOS_BUCKET, LEGACY_PROFILE_PHOTOS_BUCKET];

  await Promise.all(
    buckets.map((bucket) => supabase.storage.from(bucket).remove([storagePath]))
  );
}

/** Resolve a display URL for a storage path (public bucket first, legacy signed URL fallback). */
export async function resolveProfilePhotoUrl(
  supabase: SupabaseClient,
  storagePath: string | null | undefined
): Promise<string | null> {
  if (!storagePath) return null;

  const publicUrl = getProfilePhotoPublicUrl(storagePath);
  if (publicUrl) return publicUrl;

  return createLegacyProfilePhotoSignedUrl(supabase, storagePath);
}

/** Resolve URL respecting approval status (use isOwner for the driver's own profile view). */
export async function resolveProfilePhotoForProfile(
  supabase: SupabaseClient,
  profile: ProfilePhotoFields,
  options?: { isOwner?: boolean }
): Promise<string | null> {
  const path = getVisibleProfilePhotoPath(profile, options);
  if (!path) return null;
  return resolveProfilePhotoUrl(supabase, path);
}

async function createLegacyProfilePhotoSignedUrl(
  supabase: SupabaseClient,
  storagePath: string
): Promise<string | null> {
  const legacy = await supabase.storage
    .from(LEGACY_PROFILE_PHOTOS_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);

  if (!legacy.error && legacy.data?.signedUrl) {
    return legacy.data.signedUrl;
  }

  return null;
}

/** @deprecated Use resolveProfilePhotoUrl — kept for gradual migration */
export async function createProfilePhotoSignedUrl(
  supabase: SupabaseClient,
  storagePath: string | null | undefined
): Promise<string | null> {
  return resolveProfilePhotoUrl(supabase, storagePath);
}