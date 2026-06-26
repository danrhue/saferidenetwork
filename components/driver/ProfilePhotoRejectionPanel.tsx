'use client';

import { useState } from 'react';
import {
  profilePhotoStatusBadgeClass,
  profilePhotoStatusLabel,
} from '@/lib/profile-photo';

type ProfilePhotoRejectionPanelProps = {
  photoUrl: string | null;
  rejectionReason: string | null;
  uploading: boolean;
  onUpload: (file: File) => void | Promise<void>;
};

export default function ProfilePhotoRejectionPanel({
  photoUrl,
  rejectionReason,
  uploading,
  onUpload,
}: ProfilePhotoRejectionPanelProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="mb-8 rounded-2xl border-2 border-red-200 bg-red-50 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between gap-4 px-6 py-4 text-left"
      >
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-semibold text-red-900">Profile Photo Rejected</h2>
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${profilePhotoStatusBadgeClass('rejected')}`}
            >
              {profilePhotoStatusLabel('rejected')}
            </span>
          </div>
          <p className="mt-1 text-sm text-red-800">
            Upload a new photo here — no need to return to the full profile wizard.
          </p>
        </div>
        <span className="text-red-700 text-sm shrink-0">{expanded ? 'Hide' : 'Show'}</span>
      </button>

      {expanded && (
        <div className="px-6 pb-6 border-t border-red-200/80">
          <div className="mt-5 p-4 rounded-xl bg-white border border-red-100 text-sm text-red-900">
            <strong className="block mb-2">Reason from reviewer</strong>
            <p>{rejectionReason || 'Please upload a clear headshot that meets our photo guidelines.'}</p>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row items-center gap-6">
            <div className="w-28 h-28 rounded-full overflow-hidden border-2 border-red-200 bg-white shrink-0">
              {photoUrl ? (
                <img src={photoUrl} alt="Rejected profile" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-3xl text-gray-300">👤</div>
              )}
            </div>

            <div className="flex-1 text-center sm:text-left">
              <label className="cursor-pointer inline-block bg-[#1E3A8A] text-white px-6 py-3 rounded-xl hover:bg-[#162d6b] transition-colors font-medium">
                {uploading ? 'Uploading…' : 'Upload New Photo'}
                <input
                  type="file"
                  accept="image/jpeg,image/png"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void onUpload(file);
                    e.target.value = '';
                  }}
                />
              </label>
              <p className="mt-3 text-xs text-red-800">JPG or PNG, max 5 MB. Your new photo will be sent for review.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}