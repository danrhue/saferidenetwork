'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

const MAX_LOGO_SIZE = 5 * 1024 * 1024; // 5MB

export default function OrganizationProfile() {
  const [fullName, setFullName] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null); // signed URL for display
  const [profilePhotoPath, setProfilePhotoPath] = useState<string | null>(null); // storage path
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, organization_name, profile_photo_url')
        .eq('id', user.id)
        .single();

      if (profile) {
        setFullName(profile.full_name || '');
        setOrganizationName(profile.organization_name || '');
        setProfilePhotoPath(profile.profile_photo_url || null);

        if (profile.profile_photo_url) {
          const { data: signed } = await supabase.storage
            .from('organization-logos')
            .createSignedUrl(profile.profile_photo_url, 3600);
          setProfilePhotoUrl(signed?.signedUrl || null);
        }
      }
      setLoading(false);
    };

    fetchProfile();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: fullName,
        organization_name: organizationName,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (error) {
      setMessage('Error saving profile: ' + error.message);
    } else {
      setMessage('Profile updated successfully!');
    }
    setSaving(false);
  };

  const uploadLogo = async (file: File) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (file.size > MAX_LOGO_SIZE) {
      alert('Logo is too large. Max 5MB.');
      return;
    }
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      alert('Invalid file type. Please use JPG, PNG, or WebP.');
      return;
    }

    setUploading(true);

    try {
      const fileExt = file.name.split('.').pop()?.toLowerCase();
      const filePath = `${user.id}/logo.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('organization-logos')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Update profile
      const { error: dbError } = await supabase
        .from('profiles')
        .update({
          profile_photo_url: filePath,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (dbError) throw dbError;

      setProfilePhotoPath(filePath);

      // Get signed URL for preview
      const { data: signed } = await supabase.storage
        .from('organization-logos')
        .createSignedUrl(filePath, 3600);
      setProfilePhotoUrl(signed?.signedUrl || null);

      setMessage('Logo uploaded successfully!');
    } catch (error: any) {
      alert('Upload failed: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const removeLogo = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !profilePhotoPath) return;

    if (!confirm('Remove your organization logo?')) return;

    setUploading(true);

    try {
      await supabase.storage
        .from('organization-logos')
        .remove([profilePhotoPath]);

      await supabase
        .from('profiles')
        .update({
          profile_photo_url: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      setProfilePhotoPath(null);
      setProfilePhotoUrl(null);
      setMessage('Logo removed successfully.');
    } catch (error: any) {
      alert('Failed to remove logo: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <div className="p-8">Loading profile...</div>;

  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-bold text-blue-950 mb-2">Organization Profile</h1>
      <p className="text-blue-800 mb-8">Update your organization details</p>

      <div className="bg-white border border-gray-200 rounded-2xl p-8">
        {/* Organization Logo */}
        <div className="mb-8">
          <label className="block text-sm font-medium text-blue-950 mb-2">Organization Logo / Profile Picture</label>
          <div className="flex items-center gap-6">
            {profilePhotoUrl ? (
              <img 
                src={profilePhotoUrl} 
                alt="Organization Logo" 
                className="w-20 h-20 object-cover rounded-xl border border-gray-200" 
              />
            ) : (
              <div className="w-20 h-20 bg-gray-100 rounded-xl border flex items-center justify-center text-gray-400 text-3xl">
                🏢
              </div>
            )}
            <div className="flex flex-col gap-2">
              <label className="cursor-pointer px-4 py-2 bg-[#1E3A8A] hover:bg-blue-900 text-white text-sm font-medium rounded-xl inline-block text-center disabled:opacity-50">
                {uploading ? 'Uploading...' : profilePhotoUrl ? 'Change Logo' : 'Upload Logo'}
                <input 
                  type="file" 
                  accept="image/jpeg,image/png,image/webp" 
                  className="hidden" 
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadLogo(file);
                  }} 
                  disabled={uploading} 
                />
              </label>
              {profilePhotoPath && (
                <button 
                  type="button" 
                  onClick={removeLogo} 
                  disabled={uploading}
                  className="text-sm text-red-600 hover:text-red-700 px-2"
                >
                  Remove Logo
                </button>
              )}
              <p className="text-xs text-blue-800">Recommended: square image, max 5MB. JPG/PNG/WebP.</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-blue-950 mb-1">Contact Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-blue-950 placeholder:text-blue-700"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-blue-950 mb-1">Organization Name</label>
            <input
              type="text"
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-blue-950 placeholder:text-blue-700"
              required
            />
          </div>

          {message && (
            <p className={message.includes('Error') ? 'text-red-600' : 'text-green-600'}>
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="bg-[#1E3A8A] hover:bg-blue-900 text-white px-6 py-3 rounded-xl font-medium disabled:opacity-70"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>
    </div>
  );
}
