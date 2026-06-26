'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { authFetch } from '@/lib/auth-fetch';
import { suggestPassengerCapacity } from '@/lib/vehicle-capacity';
import { getErrorMessage } from '@/lib/errors';
import DriverOnboardingWizard from '@/components/driver/DriverOnboardingWizard';
import { saveDriverPersonalProfile } from '@/lib/driver/profile-save';
import { useProfileCompletion } from '@/lib/driver/useProfileCompletion';
import { useRequiredDriverDocuments } from '@/lib/driver/useRequiredDriverDocuments';
import {
  persistOnboardingWizardStep,
  type WizardStepSaveResult,
} from '@/lib/driver/wizard-step-save';
import {
  WIZARD_PERSONAL_SAVE_STEPS,
  clampWizardStep,
  resolveInitialWizardStep,
} from '@/lib/driver/wizard-steps';
import ProfilePhotoRejectionPanel from '@/components/driver/ProfilePhotoRejectionPanel';
import {
  deleteDriverProfilePhoto,
  submitDriverProfilePhoto,
} from '@/lib/driver/profile-photo-upload';
import { resolveProfilePhotoForProfile } from '@/lib/storage/profile-photos';

const MAX_PHOTO_SIZE = 5 * 1024 * 1024; // 5MB

export default function DriverProfile() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Photo states
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const [vehiclePhotoUrls, setVehiclePhotoUrls] = useState<string[]>([]);
  const [uploadingProfile, setUploadingProfile] = useState(false);
  const [uploadingVehicle, setUploadingVehicle] = useState(false);

  // Stripe Connect state
  const [stripeConnecting, setStripeConnecting] = useState(false);
  const [stripeMessage, setStripeMessage] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const { refresh: refreshProfileCompletion } = useProfileCompletion();

  // Vehicle & seating
  const [vehicleYear, setVehicleYear] = useState('');
  const [vehicleMake, setVehicleMake] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [passengerCapacity, setPassengerCapacity] = useState('');
  const [seatingOverrideNote, setSeatingOverrideNote] = useState('');
  const [savingVehicle, setSavingVehicle] = useState(false);
  const [vehicleMessage, setVehicleMessage] = useState<string | null>(null);
  const [capacityTouched, setCapacityTouched] = useState(false);
  const [savingPersonal, setSavingPersonal] = useState(false);
  const [savedWizardStep, setSavedWizardStep] = useState(1);
  const [documentsUploaded, setDocumentsUploaded] = useState(0);
  const {
    uploadableDocuments,
    refresh: refreshRequiredDocuments,
  } = useRequiredDriverDocuments();

  const documentsRequired = uploadableDocuments.length;

  useEffect(() => {
    if (searchParams.get('stripe') === 'complete') {
      setStripeMessage('Stripe onboarding submitted. Status will update shortly.');
    } else if (searchParams.get('stripe') === 'refresh') {
      setStripeMessage('Please complete your Stripe setup to receive trip payouts.');
    }
  }, [searchParams]);

  const handleConnectStripe = async () => {
    setStripeConnecting(true);
    setStripeMessage(null);
    try {
      const createRes = await authFetch('/api/stripe/connect/create-account', { method: 'POST' });
      const createData = await createRes.json();
      if (!createRes.ok) throw new Error(createData.error || 'Failed to create Stripe account');

      const linkRes = await authFetch('/api/stripe/connect/account-link', { method: 'POST' });
      const linkData = await linkRes.json();
      if (!linkRes.ok) throw new Error(linkData.error || 'Failed to generate onboarding link');

      if (linkData.url) {
        window.location.href = linkData.url;
        return;
      }
      throw new Error('No onboarding URL returned');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Stripe connection failed';
      setStripeMessage(msg);
    } finally {
      setStripeConnecting(false);
    }
  };

  const isStripeConnected =
    profile?.stripe_account_id &&
    profile?.stripe_onboarding_complete &&
    profile?.stripe_payouts_enabled;

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setUser(user);

      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      const profileData = prof
        ? {
            ...prof,
            email: prof.email || user.email || '',
            mailing_same_as_physical: prof.mailing_same_as_physical !== false,
          }
        : {
            id: user.id,
            email: user.email || '',
            mailing_same_as_physical: true,
          };

      setProfile(profileData);

      const initialStep = resolveInitialWizardStep(
        searchParams.get('step'),
        prof?.onboarding_wizard_step as number | undefined
      );
      setSavedWizardStep(initialStep);

      if (!searchParams.get('step') && prof?.onboarding_wizard_step) {
        router.replace(`/dashboard/profile?step=${initialStep}`, { scroll: false });
      }

      if (prof) {
        setVehicleYear(prof.vehicle_year ? String(prof.vehicle_year) : '');
        setVehicleMake(prof.vehicle_make || '');
        setVehicleModel(prof.vehicle_model || '');
        setPassengerCapacity(
          prof.passenger_capacity != null ? String(prof.passenger_capacity) : ''
        );
        setSeatingOverrideNote(prof.seating_override_note || '');
      }

      if (prof?.profile_photo_url) {
        const photoUrl = await resolveProfilePhotoForProfile(supabase, prof, { isOwner: true });
        setProfilePhotoUrl(photoUrl);
      }

      if (prof?.vehicle_photos && Array.isArray(prof.vehicle_photos) && prof.vehicle_photos.length > 0) {
        const signed = await Promise.all(
          prof.vehicle_photos.map(async (path: string) => {
            const { data } = await supabase.storage
              .from('driver-photos')
              .createSignedUrl(path, 3600);
            return data?.signedUrl;
          })
        );
        setVehiclePhotoUrls(signed.filter(Boolean) as string[]);
      }

      const docsRes = await fetch('/api/driver/documents', { cache: 'no-store' });
      if (docsRes.ok) {
        const docs = await docsRes.json();
        if (Array.isArray(docs)) {
          const types = new Set(
            docs.map((d: { document_type: string }) => d.document_type)
          );
          setDocumentsUploaded(types.size);
        }
      }

      setLoading(false);
    };

    fetchData();
  }, []);

  const uploadProfilePhoto = async (file: File) => {
    if (!user) return;
    setUploadingProfile(true);
    try {
      const { path, photoUrl } = await submitDriverProfilePhoto(supabase, user.id, file);
      setProfile((p: any) => ({
        ...p,
        profile_photo_url: path,
        profile_photo_status: 'pending',
        profile_photo_rejection_reason: null,
      }));
      setProfilePhotoUrl(photoUrl);
      await refreshProfileCompletion();
      alert('Profile photo submitted for review!');
    } catch (e: any) {
      alert('Upload failed: ' + e.message);
    } finally {
      setUploadingProfile(false);
    }
  };

  const deleteProfilePhoto = async () => {
    if (!profile?.profile_photo_url || !user) return;
    try {
      await deleteDriverProfilePhoto(supabase, user.id, profile.profile_photo_url);
      setProfile((p: any) => ({
        ...p,
        profile_photo_url: null,
        profile_photo_status: null,
        profile_photo_rejection_reason: null,
      }));
      setProfilePhotoUrl(null);
    } catch (e: any) {
      alert('Delete failed: ' + e.message);
    }
  };

  const uploadVehiclePhotos = async (files: FileList) => {
    if (!user) return;
    const currentPaths = profile?.vehicle_photos || [];
    if (currentPaths.length + files.length > 5) {
      alert('Max 5 vehicle photos.');
      return;
    }
    setUploadingVehicle(true);
    try {
      const newPaths: string[] = [];
      for (const file of Array.from(files)) {
        if (file.size > MAX_PHOTO_SIZE) continue;
        if (!['image/jpeg', 'image/png'].includes(file.type)) continue;
        const ext = file.name.split('.').pop()!.toLowerCase();
        const path = `${user.id}/vehicle-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: upErr } = await supabase.storage.from('driver-photos').upload(path, file, { upsert: true });
        if (upErr) continue;
        newPaths.push(path);
      }
      if (newPaths.length === 0) return;

      const updatedPaths = [...currentPaths, ...newPaths];
      await supabase.from('profiles').update({ vehicle_photos: updatedPaths }).eq('id', user.id);

      setProfile((p: any) => ({ ...p, vehicle_photos: updatedPaths }));

      const signedNew = await Promise.all(
        newPaths.map(async (p) => {
          const { data } = await supabase.storage.from('driver-photos').createSignedUrl(p, 3600);
          return data?.signedUrl;
        })
      );
      setVehiclePhotoUrls(prev => [...prev, ...signedNew.filter(Boolean) as string[] ]);
      alert(`${newPaths.length} vehicle photo(s) added!`);
    } catch (e: any) {
      alert('Upload failed: ' + e.message);
    } finally {
      setUploadingVehicle(false);
    }
  };

  const deleteVehiclePhoto = async (index: number) => {
    const currentPaths: string[] = profile?.vehicle_photos || [];
    const path = currentPaths[index];
    const newPaths = currentPaths.filter((_, i) => i !== index);
    try {
      await supabase.storage.from('driver-photos').remove([path]);
      await supabase.from('profiles').update({ vehicle_photos: newPaths }).eq('id', user.id);
      setProfile((p: any) => ({ ...p, vehicle_photos: newPaths }));
      setVehiclePhotoUrls(prev => prev.filter((_, i) => i !== index));
    } catch (e: any) {
      alert('Delete failed: ' + e.message);
    }
  };

  const yearNum = vehicleYear ? parseInt(vehicleYear, 10) : null;
  const capacitySuggestion = suggestPassengerCapacity(yearNum, vehicleMake, vehicleModel);
  const capacityNum = passengerCapacity ? parseInt(passengerCapacity, 10) : null;
  const suggestedCapacity = capacitySuggestion.suggestedPassengers;
  const isCapacityOverride =
    suggestedCapacity != null &&
    capacityNum != null &&
    capacityNum !== suggestedCapacity;
  const seatingStatus = profile?.seating_approval_status ?? 'approved';

  useEffect(() => {
    if (!capacityTouched && suggestedCapacity != null && !passengerCapacity) {
      setPassengerCapacity(String(suggestedCapacity));
    }
  }, [suggestedCapacity, capacityTouched, passengerCapacity]);

  const handlePersonalChange = (field: string, value: unknown) => {
    setProfile((prev: Record<string, unknown> | null) => ({
      ...(prev ?? {}),
      [field]: value,
    }));
  };

  const persistPersonalProfile = useCallback(async (): Promise<WizardStepSaveResult> => {
    if (!user || !profile) {
      return { ok: false, error: 'You must be signed in to save your profile.' };
    }

    setSavingPersonal(true);
    try {
      const { error } = await saveDriverPersonalProfile(supabase, user.id, profile);
      if (error) return { ok: false, error: error.message };

      const firstName = String(profile.first_name ?? '').trim();
      const lastName = String(profile.last_name ?? '').trim();
      const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();

      setProfile((prev: Record<string, unknown>) => ({
        ...prev,
        full_name: fullName || prev.full_name,
      }));

      return { ok: true };
    } finally {
      setSavingPersonal(false);
    }
  }, [user, profile]);

  const persistVehicleProfile = useCallback(
    async (options?: { silent?: boolean }): Promise<WizardStepSaveResult> => {
      setSavingVehicle(true);
      if (!options?.silent) setVehicleMessage(null);
      try {
        const response = await authFetch('/api/driver/vehicle-profile', {
          method: 'POST',
          body: JSON.stringify({
            vehicle_year: yearNum,
            vehicle_make: vehicleMake,
            vehicle_model: vehicleModel,
            passenger_capacity: capacityNum,
            seating_override_note: isCapacityOverride ? seatingOverrideNote : '',
          }),
        });
        const data = await response.json();
        if (!response.ok) {
          return { ok: false, error: data.error || 'Failed to save vehicle information' };
        }

        setProfile((p: Record<string, unknown>) => ({ ...p, ...data.profile }));
        if (!options?.silent) {
          setVehicleMessage(
            data.pendingApproval
              ? 'Saved. Your seating override is pending admin approval — you cannot submit offers until approved.'
              : 'Vehicle and seating capacity saved and approved.'
          );
        }
        return { ok: true };
      } catch (err: unknown) {
        const message = getErrorMessage(err);
        if (!options?.silent) setVehicleMessage(message);
        return { ok: false, error: message };
      } finally {
        setSavingVehicle(false);
      }
    },
    [
      yearNum,
      vehicleMake,
      vehicleModel,
      capacityNum,
      isCapacityOverride,
      seatingOverrideNote,
    ]
  );

  const saveWizardStep = useCallback(
    async (
      step: number,
      options?: { resumeStep?: number }
    ): Promise<WizardStepSaveResult> => {
      if (!user) {
        return { ok: false, error: 'You must be signed in to save your profile.' };
      }

      let result: WizardStepSaveResult = { ok: true };

      if (WIZARD_PERSONAL_SAVE_STEPS.has(step)) {
        result = await persistPersonalProfile();
      } else if (step === 8) {
        result = await persistVehicleProfile({ silent: true });
      } else if (step === 2) {
        // Operating states are persisted by the wizard before this runs.
        result = { ok: true };
      }

      if (!result.ok) return result;

      const stepToPersist = clampWizardStep(options?.resumeStep ?? step);
      const stepPersist = await persistOnboardingWizardStep(supabase, user.id, stepToPersist);
      if (!stepPersist.ok) return stepPersist;

      setSavedWizardStep(stepToPersist);
      await refreshProfileCompletion();
      return { ok: true };
    },
    [user, persistPersonalProfile, persistVehicleProfile, refreshProfileCompletion]
  );

  const handleWizardStepAdvanced = useCallback(
    (step: number) => {
      const safe = clampWizardStep(step);
      setSavedWizardStep(safe);
      router.replace(`/dashboard/profile?step=${safe}`, { scroll: false });
    },
    [router]
  );

  const saveVehicleProfile = async () => {
    const result = await persistVehicleProfile();
    if (result.ok && user) {
      await persistOnboardingWizardStep(supabase, user.id, 8);
      setSavedWizardStep(8);
      await refreshProfileCompletion();
    }
  };

  if (loading) return <div className="p-8">Loading profile...</div>;

  const photoRejected = profile?.profile_photo_status === 'rejected';

  return (
    <div className="max-w-5xl">
      {photoRejected && profile?.role !== 'organization' && (
        <ProfilePhotoRejectionPanel
          photoUrl={profilePhotoUrl}
          rejectionReason={profile?.profile_photo_rejection_reason ?? null}
          uploading={uploadingProfile}
          onUpload={uploadProfilePhoto}
        />
      )}

      {profile?.role === 'organization' && (
        <h1 className="text-3xl font-bold text-gray-900 mb-2">My Profile</h1>
      )}

      {profile?.role === 'organization' ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6">
          <div className="space-y-3">
            <div>
              <span className="text-sm text-gray-600">Full Name</span>
              <p className="text-lg text-blue-950">{profile?.full_name || user?.user_metadata?.full_name}</p>
            </div>
            <div>
              <span className="text-sm text-gray-600">Email</span>
              <p className="text-lg text-blue-950">{user?.email}</p>
            </div>
            {profile?.organization_name && (
              <div>
                <span className="text-sm text-gray-600">Organization</span>
                <p className="text-lg text-blue-950">{profile.organization_name}</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <DriverOnboardingWizard
          initialStep={savedWizardStep}
          onDrivingStatesSaved={async (result) => {
            setProfile((p: Record<string, unknown>) => ({
              ...p,
              driving_states: result.drivingStates,
            }));
            await refreshRequiredDocuments();
            await refreshProfileCompletion();
          }}
          profile={profile ?? {}}
          onChange={handlePersonalChange}
          onSaveStep={saveWizardStep}
          onStepAdvanced={handleWizardStepAdvanced}
          profilePhotoUrl={profilePhotoUrl}
          uploadingProfile={uploadingProfile}
          onUploadProfilePhoto={uploadProfilePhoto}
          onDeleteProfilePhoto={deleteProfilePhoto}
          vehiclePhotoUrls={vehiclePhotoUrls}
          uploadingVehicle={uploadingVehicle}
          onUploadVehiclePhotos={uploadVehiclePhotos}
          onDeleteVehiclePhoto={deleteVehiclePhoto}
          vehicleYear={vehicleYear}
          vehicleMake={vehicleMake}
          vehicleModel={vehicleModel}
          passengerCapacity={passengerCapacity}
          seatingOverrideNote={seatingOverrideNote}
          onVehicleYearChange={setVehicleYear}
          onVehicleMakeChange={setVehicleMake}
          onVehicleModelChange={setVehicleModel}
          onPassengerCapacityChange={(v) => {
            setCapacityTouched(true);
            setPassengerCapacity(v);
          }}
          onSeatingOverrideNoteChange={setSeatingOverrideNote}
          capacitySuggestion={capacitySuggestion}
          isCapacityOverride={isCapacityOverride}
          seatingStatus={seatingStatus}
          savingVehicle={savingVehicle}
          vehicleMessage={vehicleMessage}
          onSaveVehicle={saveVehicleProfile}
          documentsUploaded={documentsUploaded}
          documentsRequired={documentsRequired}
          isStripeConnected={!!isStripeConnected}
          hasStripeAccount={!!profile?.stripe_account_id}
          stripeConnecting={stripeConnecting}
          stripeMessage={stripeMessage}
          onConnectStripe={handleConnectStripe}
        />
      )}

    </div>
  );
}
