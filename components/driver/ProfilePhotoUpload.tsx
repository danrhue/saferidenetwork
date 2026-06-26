'use client';

import {
  PROFILE_PHOTO_GUIDELINES,
  normalizeProfilePhotoStatus,
  profilePhotoStatusBadgeClass,
  profilePhotoStatusLabel,
  type ProfilePhotoStatus,
} from '@/lib/profile-photo';

type ProfilePhotoUploadProps = {
  photoUrl: string | null;
  status: ProfilePhotoStatus | null;
  rejectionReason?: string | null;
  uploading: boolean;
  onUpload: (file: File) => void;
  onDelete: () => void;
};

export default function ProfilePhotoUpload({
  photoUrl,
  status,
  rejectionReason,
  uploading,
  onUpload,
  onDelete,
}: ProfilePhotoUploadProps) {
  const hasPhoto = Boolean(photoUrl);
  const normalizedStatus = normalizeProfilePhotoStatus(status);

  return (
    <div className="text-center py-4">
      <div className="max-w-lg mx-auto mb-8 text-left bg-blue-50 border border-blue-100 rounded-2xl p-5">
        <h3 className="font-semibold text-blue-950 mb-3">Photo Guidelines</h3>
        <ul className="space-y-2 text-sm text-blue-900">
          {PROFILE_PHOTO_GUIDELINES.map((guideline) => (
            <li key={guideline} className="flex gap-2">
              <span className="text-blue-600 shrink-0">•</span>
              <span>{guideline}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-blue-700">
          Photos are reviewed by our team before they appear to riders and organizations.
        </p>
      </div>

      {normalizedStatus && (
        <div className="mb-6 flex justify-center">
          <span
            className={`inline-flex items-center px-4 py-1.5 rounded-full text-sm font-medium border ${profilePhotoStatusBadgeClass(normalizedStatus)}`}
          >
            {profilePhotoStatusLabel(normalizedStatus)}
          </span>
        </div>
      )}

      {normalizedStatus === 'pending' && hasPhoto && (
        <div className="max-w-md mx-auto mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-900 text-left">
          <strong>Under review.</strong> Your photo has been submitted and is waiting for admin
          approval. You can replace it anytime before it is approved.
        </div>
      )}

      {normalizedStatus === 'rejected' && (
        <div className="max-w-md mx-auto mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800 text-left">
          <strong>Photo rejected.</strong>
          {rejectionReason ? (
            <p className="mt-2">{rejectionReason}</p>
          ) : (
            <p className="mt-2">Please upload a new photo that meets the guidelines above.</p>
          )}
        </div>
      )}

      {normalizedStatus === 'approved' && hasPhoto && (
        <div className="max-w-md mx-auto mb-6 p-4 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800 text-left">
          <strong>Approved.</strong> Your profile photo is visible to riders and organizations.
        </div>
      )}

      <div className="mx-auto w-48 h-48 bg-gray-100 rounded-full flex items-center justify-center mb-8 overflow-hidden border-2 border-blue-100 shadow-sm">
        {photoUrl ? (
          <img src={photoUrl} alt="Profile" className="w-full h-full object-cover" />
        ) : (
          <span className="text-6xl text-gray-300">👤</span>
        )}
      </div>

      <label className="cursor-pointer inline-block bg-[#1E3A8A] text-white px-8 py-3 rounded-2xl hover:bg-[#162d6b] transition-colors">
        {uploading
          ? 'Uploading…'
          : hasPhoto
            ? normalizedStatus === 'rejected'
              ? 'Upload New Photo'
              : 'Change Photo'
            : 'Upload Profile Photo'}
        <input
          type="file"
          accept="image/jpeg,image/png"
          className="hidden"
          disabled={uploading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onUpload(file);
            e.target.value = '';
          }}
        />
      </label>

      {hasPhoto && (
        <button
          type="button"
          onClick={onDelete}
          disabled={uploading}
          className="block mx-auto mt-4 text-sm text-red-600 hover:text-red-700 disabled:opacity-50"
        >
          Remove Photo
        </button>
      )}
    </div>
  );
}