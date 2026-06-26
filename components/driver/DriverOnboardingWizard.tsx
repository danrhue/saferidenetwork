'use client';

import Link from 'next/link';
import { InputHTMLAttributes, useMemo, useState } from 'react';
import OperatingStatesStep, {
  type OperatingStatesSaveResult,
} from '@/components/driver/OperatingStatesStep';
import { calculateDriverCompletion } from '@/lib/driver/onboarding-completion';
import type { WizardStepSaveResult } from '@/lib/driver/wizard-step-save';
import {
  WIZARD_MAILING_FIELDS,
  WIZARD_STEP_FIELDS,
  WIZARD_STEPS,
  clampWizardStep,
} from '@/lib/driver/wizard-steps';
import { normalizeStateCodes } from '@/lib/driver/us-states';
import type { CapacitySuggestion } from '@/lib/vehicle-capacity';
import ProfilePhotoUpload from '@/components/driver/ProfilePhotoUpload';

export type PersonalProfile = Record<string, unknown>;

function numValue(value: unknown): string | number {
  if (value == null || value === '') return '';
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return value;
  return '';
}

function hasValue(profile: PersonalProfile, field: string): boolean {
  const value = profile[field];
  if (value == null || value === '') return false;
  if (typeof value === 'string') return value.trim().length > 0;
  return true;
}

export type DriverOnboardingWizardProps = {
  profile: PersonalProfile;
  onChange: (field: string, value: unknown) => void;
  /** Persist current step data before advancing. Return { ok: false } to stay on step. */
  onSaveStep: (step: number) => Promise<WizardStepSaveResult>;
  /** Called after a successful save + step advance (URL sync, sidebar refresh, etc.). */
  onStepAdvanced?: (step: number) => void | Promise<void>;
  profilePhotoUrl: string | null;
  uploadingProfile: boolean;
  onUploadProfilePhoto: (file: File) => void;
  onDeleteProfilePhoto: () => void;
  vehiclePhotoUrls: string[];
  uploadingVehicle: boolean;
  onUploadVehiclePhotos: (files: FileList) => void;
  onDeleteVehiclePhoto: (index: number) => void;
  vehicleYear: string;
  vehicleMake: string;
  vehicleModel: string;
  passengerCapacity: string;
  seatingOverrideNote: string;
  onVehicleYearChange: (value: string) => void;
  onVehicleMakeChange: (value: string) => void;
  onVehicleModelChange: (value: string) => void;
  onPassengerCapacityChange: (value: string) => void;
  onSeatingOverrideNoteChange: (value: string) => void;
  capacitySuggestion: CapacitySuggestion;
  isCapacityOverride: boolean;
  seatingStatus: string;
  savingVehicle: boolean;
  vehicleMessage: string | null;
  onSaveVehicle: () => void;
  documentsUploaded: number;
  documentsRequired: number;
  isStripeConnected: boolean;
  hasStripeAccount: boolean;
  stripeConnecting: boolean;
  stripeMessage: string | null;
  onConnectStripe: () => void;
  initialStep?: number;
  onDrivingStatesSaved?: (result: OperatingStatesSaveResult) => void | Promise<void>;
};

export default function DriverOnboardingWizard(props: DriverOnboardingWizardProps) {
  const {
    profile,
    onChange,
    onSaveStep,
    onStepAdvanced,
    profilePhotoUrl,
    uploadingProfile,
    onUploadProfilePhoto,
    onDeleteProfilePhoto,
    vehiclePhotoUrls,
    uploadingVehicle,
    onUploadVehiclePhotos,
    onDeleteVehiclePhoto,
    vehicleYear,
    vehicleMake,
    vehicleModel,
    passengerCapacity,
    seatingOverrideNote,
    onVehicleYearChange,
    onVehicleMakeChange,
    onVehicleModelChange,
    onPassengerCapacityChange,
    onSeatingOverrideNoteChange,
    capacitySuggestion,
    isCapacityOverride,
    seatingStatus,
    savingVehicle,
    vehicleMessage,
    onSaveVehicle,
    documentsUploaded,
    documentsRequired,
    isStripeConnected,
    hasStripeAccount,
    stripeConnecting,
    stripeMessage,
    onConnectStripe,
    initialStep = 1,
    onDrivingStatesSaved,
  } = props;

  const [currentStep, setCurrentStep] = useState(clampWizardStep(initialStep));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [stepSaving, setStepSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  const completionProfile = useMemo(
    () => ({
      ...profile,
      vehicle_year: vehicleYear ? parseInt(vehicleYear, 10) : profile.vehicle_year,
      vehicle_make: vehicleMake || profile.vehicle_make,
      vehicle_model: vehicleModel || profile.vehicle_model,
      passenger_capacity: passengerCapacity
        ? parseInt(passengerCapacity, 10)
        : profile.passenger_capacity,
    }),
    [profile, vehicleYear, vehicleMake, vehicleModel, passengerCapacity]
  );

  const completion = calculateDriverCompletion(completionProfile, {
    documentsUploaded,
    documentsRequired,
  });

  const handleChange = (field: string, value: unknown) => {
    onChange(field, value);
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const validateStep = (step = currentStep) => {
    if (step >= 7) {
      setErrors({});
      return true;
    }

    const newErrors: Record<string, string> = {};

    if (step === 2) {
      const states = normalizeStateCodes(profile.driving_states as string[] | undefined);
      if (states.length === 0) {
        newErrors.driving_states =
          'Select at least one operating state, then click Save Operating States.';
      }
      setErrors(newErrors);
      return states.length === 0 ? false : true;
    }

    if (step === 8) {
      if (!vehicleYear?.trim()) newErrors.vehicle_year = 'Vehicle year is required';
      if (!vehicleMake?.trim()) newErrors.vehicle_make = 'Vehicle make is required';
      if (!vehicleModel?.trim()) newErrors.vehicle_model = 'Vehicle model is required';
      if (!passengerCapacity?.trim()) {
        newErrors.passenger_capacity = 'Passenger capacity is required';
      }
      if (isCapacityOverride && !seatingOverrideNote?.trim()) {
        newErrors.seating_override_note = 'Explain your seating override before continuing';
      }
      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
    }

    (WIZARD_STEP_FIELDS[step] || []).forEach((field) => {
      if (!hasValue(profile, field)) {
        newErrors[field] = 'This field is required';
      }
    });

    if (step === 1) {
      const email = String(profile.email ?? '');
      if (email && !email.includes('@')) {
        newErrors.email = 'Please enter a valid email';
      }
    }

    if (step === 3 && profile.mailing_same_as_physical === false) {
      WIZARD_MAILING_FIELDS.forEach((field) => {
        if (!hasValue(profile, field)) {
          newErrors[field] = 'This field is required';
        }
      });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const advanceToStep = async (next: number) => {
    setCurrentStep(next);
    setSaveSuccess('Progress saved.');
    await onStepAdvanced?.(next);
  };

  const handleValidationFailure = () => {
    if (currentStep === 8) {
      setSaveError('Please complete all required vehicle fields before continuing.');
    }
  };

  const nextStep = async () => {
    setSaveError(null);
    setSaveSuccess(null);
    if (!validateStep()) {
      handleValidationFailure();
      return;
    }

    setStepSaving(true);
    try {
      const result = await onSaveStep(currentStep);
      if (!result.ok) {
        setSaveError(result.error);
        return;
      }

      if (currentStep < WIZARD_STEPS.length) {
        await advanceToStep(currentStep + 1);
      }
    } finally {
      setStepSaving(false);
    }
  };

  const goToStep = async (targetStep: number) => {
    if (targetStep === currentStep || stepSaving) return;

    if (targetStep < currentStep) {
      setSaveError(null);
      setSaveSuccess(null);
      setCurrentStep(targetStep);
      void onStepAdvanced?.(targetStep);
      return;
    }

    setSaveError(null);
    setSaveSuccess(null);
    if (!validateStep()) {
      handleValidationFailure();
      return;
    }

    setStepSaving(true);
    try {
      const result = await onSaveStep(currentStep);
      if (!result.ok) {
        setSaveError(result.error);
        return;
      }
      setCurrentStep(targetStep);
      setSaveSuccess('Progress saved.');
      await onStepAdvanced?.(targetStep);
    } finally {
      setStepSaving(false);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setSaveError(null);
      setSaveSuccess(null);
      const prev = currentStep - 1;
      setCurrentStep(prev);
      void onStepAdvanced?.(prev);
    }
  };

  const finishOnboarding = async () => {
    setSaveError(null);
    setSaveSuccess(null);
    setStepSaving(true);
    try {
      const result = await onSaveStep(currentStep);
      if (!result.ok) {
        setSaveError(result.error);
        return;
      }
      setSaveSuccess('Onboarding progress saved. Complete any remaining steps to activate your account.');
      await onStepAdvanced?.(currentStep);
    } finally {
      setStepSaving(false);
    }
  };

  return (
    <div className="mb-8">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-4xl font-bold text-gray-900">Complete Your Profile</h1>
          <p className="text-gray-600 mt-1">Finish all steps to activate your driver account</p>
        </div>
        <div className="text-right">
          <div className="text-5xl font-bold text-[#1E3A8A]">{completion}%</div>
          <div className="text-sm text-gray-500">Complete</div>
        </div>
      </div>

      <div className="h-3 bg-gray-100 rounded-full mb-10 overflow-hidden">
        <div
          className="h-3 bg-[#1E3A8A] transition-all duration-500"
          style={{ width: `${completion}%` }}
        />
      </div>

      <div className="flex justify-between mb-12 overflow-x-auto pb-4 gap-2">
        {WIZARD_STEPS.map((step) => (
          <button
            key={step.id}
            type="button"
            onClick={() => void goToStep(step.id)}
            disabled={stepSaving}
            className={`flex flex-col items-center min-w-[72px] sm:min-w-[90px] shrink-0 ${
              currentStep === step.id ? 'text-[#1E3A8A]' : 'text-gray-400'
            }`}
          >
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center border-2 mb-2 text-sm font-semibold ${
                currentStep === step.id
                  ? 'border-[#1E3A8A] bg-white'
                  : currentStep > step.id
                    ? 'border-[#1E3A8A] bg-[#1E3A8A] text-white'
                    : 'border-gray-300'
              }`}
            >
              {step.id}
            </div>
            <div className="text-xs font-medium text-center leading-tight">{step.title}</div>
          </button>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-3xl p-6 md:p-10 min-h-[520px]">
        {currentStep === 1 && (
          <PersonalInfoStep profile={profile} handleChange={handleChange} errors={errors} />
        )}
        {currentStep === 2 && (
          <div>
            <OperatingStatesStep
              variant="wizard"
              initialStates={(profile.driving_states as string[] | undefined) ?? []}
              onSaved={async (result) => {
                handleChange('driving_states', result.drivingStates);
                await onDrivingStatesSaved?.(result);
              }}
            />
            {errors.driving_states && (
              <p className="mt-3 text-sm text-red-600" role="alert">
                {errors.driving_states}
              </p>
            )}
          </div>
        )}
        {currentStep === 3 && (
          <AddressStep profile={profile} handleChange={handleChange} errors={errors} />
        )}
        {currentStep === 4 && (
          <LicenseStep profile={profile} handleChange={handleChange} errors={errors} />
        )}
        {currentStep === 5 && (
          <PersonalDetailsStep profile={profile} handleChange={handleChange} errors={errors} />
        )}
        {currentStep === 6 && (
          <EmergencyStep profile={profile} handleChange={handleChange} errors={errors} />
        )}
        {currentStep === 7 && (
          <PhotoStep
            profilePhotoUrl={profilePhotoUrl}
            profilePhotoStatus={
              typeof profile.profile_photo_status === 'string'
                ? profile.profile_photo_status
                : null
            }
            profilePhotoRejectionReason={
              typeof profile.profile_photo_rejection_reason === 'string'
                ? profile.profile_photo_rejection_reason
                : null
            }
            uploading={uploadingProfile}
            onUpload={onUploadProfilePhoto}
            onDelete={onDeleteProfilePhoto}
          />
        )}
        {currentStep === 8 && (
          <VehicleStep
            vehicleYear={vehicleYear}
            vehicleMake={vehicleMake}
            vehicleModel={vehicleModel}
            passengerCapacity={passengerCapacity}
            seatingOverrideNote={seatingOverrideNote}
            onVehicleYearChange={onVehicleYearChange}
            onVehicleMakeChange={onVehicleMakeChange}
            onVehicleModelChange={onVehicleModelChange}
            onPassengerCapacityChange={onPassengerCapacityChange}
            onSeatingOverrideNoteChange={onSeatingOverrideNoteChange}
            capacitySuggestion={capacitySuggestion}
            isCapacityOverride={isCapacityOverride}
            seatingStatus={seatingStatus}
            savingVehicle={savingVehicle}
            vehicleMessage={vehicleMessage}
            onSaveVehicle={onSaveVehicle}
            vehiclePhotoUrls={vehiclePhotoUrls}
            uploadingVehicle={uploadingVehicle}
            onUploadVehiclePhotos={onUploadVehiclePhotos}
            onDeleteVehiclePhoto={onDeleteVehiclePhoto}
            vehiclePhotoCount={(profile.vehicle_photos as string[] | undefined)?.length ?? 0}
          />
        )}
        {currentStep === 9 && (
          <PaymentStep
            isStripeConnected={isStripeConnected}
            hasStripeAccount={hasStripeAccount}
            stripeConnecting={stripeConnecting}
            stripeMessage={stripeMessage}
            onConnectStripe={onConnectStripe}
          />
        )}
        {currentStep === 10 && (
          <DocumentsStep
            documentsUploaded={documentsUploaded}
            documentsRequired={documentsRequired}
          />
        )}
      </div>

      {(saveError || saveSuccess) && (
        <div className="mt-8 space-y-2">
          {saveError && (
            <div
              className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800"
              role="alert"
            >
              <strong>Could not save this step.</strong> {saveError} Your entries are still on this
              page — fix the issue and try again.
            </div>
          )}
          {saveSuccess && !saveError && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800">
              {saveSuccess}
            </div>
          )}
        </div>
      )}

      <div className="flex justify-between mt-6">
        <button
          type="button"
          onClick={prevStep}
          disabled={currentStep === 1 || stepSaving}
          className="px-10 py-4 border border-gray-300 rounded-2xl text-blue-950 disabled:opacity-40 hover:bg-gray-50"
        >
          Previous
        </button>

        {currentStep < WIZARD_STEPS.length ? (
          <button
            type="button"
            onClick={() => void nextStep()}
            disabled={stepSaving}
            className="px-12 py-4 bg-[#1E3A8A] text-white rounded-2xl hover:bg-[#162d6b] disabled:opacity-70 min-w-[160px]"
          >
            {stepSaving ? 'Saving…' : 'Next Step →'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void finishOnboarding()}
            disabled={stepSaving}
            className="px-12 py-4 bg-green-600 text-white rounded-2xl hover:bg-green-700 disabled:opacity-70 min-w-[160px]"
          >
            {stepSaving ? 'Saving…' : 'Finish Onboarding'}
          </button>
        )}
      </div>
    </div>
  );
}

function StepGuidance({
  title,
  description,
  centered = false,
}: {
  title: string;
  description: string;
  centered?: boolean;
}) {
  return (
    <div className={`mb-8 ${centered ? 'text-center' : ''}`}>
      <h2 className="text-2xl font-semibold text-blue-950 mb-2">{title}</h2>
      <p className={`text-gray-600 ${centered ? 'max-w-md mx-auto' : ''}`}>{description}</p>
    </div>
  );
}

type StepProps = {
  profile: PersonalProfile;
  handleChange: (field: string, value: unknown) => void;
  errors: Record<string, string>;
};

function PersonalInfoStep({ profile, handleChange, errors }: StepProps) {
  return (
    <div>
      <StepGuidance
        title="Personal Information"
        description="We need your basic contact information so organizations can reach you and we can verify your identity."
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Input label="First Name *" value={String(profile.first_name ?? '')} onChange={(v) => handleChange('first_name', v)} error={errors.first_name} />
      <Input label="Last Name *" value={String(profile.last_name ?? '')} onChange={(v) => handleChange('last_name', v)} error={errors.last_name} />
      <Input label="Email Address *" type="email" value={String(profile.email ?? '')} onChange={(v) => handleChange('email', v)} error={errors.email} />
      <Input label="Phone Number *" value={String(profile.phone ?? '')} onChange={(v) => handleChange('phone', v)} error={errors.phone} />
      <Select label="Phone Type *" value={String(profile.phone_type ?? '')} onChange={(v) => handleChange('phone_type', v)} options={['Mobile', 'Home', 'Work']} />
      </div>
    </div>
  );
}

function AddressStep({ profile, handleChange, errors }: StepProps) {
  const mailingSame = profile.mailing_same_as_physical !== false;
  return (
    <div className="space-y-8">
      <StepGuidance
        title="Addresses"
        description="We collect your physical address for background checks and safety verification. Mailing address helps with important documents."
      />
      <div>
        <h3 className="text-lg font-semibold text-[#1E3A8A] mb-4">Physical Address</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Input label="Address Line 1 *" value={String(profile.physical_address_line1 ?? '')} onChange={(v) => handleChange('physical_address_line1', v)} error={errors.physical_address_line1} />
          <Input label="Address Line 2" value={String(profile.physical_address_line2 ?? '')} onChange={(v) => handleChange('physical_address_line2', v)} />
          <Input label="City *" value={String(profile.physical_city ?? '')} onChange={(v) => handleChange('physical_city', v)} error={errors.physical_city} />
          <Input label="State *" value={String(profile.physical_state ?? '')} onChange={(v) => handleChange('physical_state', v)} error={errors.physical_state} />
          <Input label="Postal Code *" value={String(profile.physical_postal_code ?? '')} onChange={(v) => handleChange('physical_postal_code', v)} error={errors.physical_postal_code} />
        </div>
      </div>
      <div>
        <h3 className="text-lg font-semibold text-[#1E3A8A] mb-4">Mailing Address</h3>
        <label className="flex items-center gap-3 mb-6 text-blue-950">
          <input type="checkbox" checked={mailingSame} onChange={(e) => handleChange('mailing_same_as_physical', e.target.checked)} />
          Mailing Address is the same as Physical Address
        </label>
        {!mailingSame && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input label="Mailing Address Line 1 *" value={String(profile.mailing_address_line1 ?? '')} onChange={(v) => handleChange('mailing_address_line1', v)} error={errors.mailing_address_line1} />
            <Input label="Mailing Address Line 2" value={String(profile.mailing_address_line2 ?? '')} onChange={(v) => handleChange('mailing_address_line2', v)} />
            <Input label="City *" value={String(profile.mailing_city ?? '')} onChange={(v) => handleChange('mailing_city', v)} error={errors.mailing_city} />
            <Input label="State *" value={String(profile.mailing_state ?? '')} onChange={(v) => handleChange('mailing_state', v)} error={errors.mailing_state} />
            <Input label="Postal Code *" value={String(profile.mailing_postal_code ?? '')} onChange={(v) => handleChange('mailing_postal_code', v)} error={errors.mailing_postal_code} />
          </div>
        )}
      </div>
    </div>
  );
}

function LicenseStep({ profile, handleChange, errors }: StepProps) {
  return (
    <div>
      <StepGuidance
        title="Driver's License"
        description="Your license information is required for background checks and to confirm you are legally allowed to drive."
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Input label="Driver's License Number *" value={String(profile.drivers_license_number ?? '')} onChange={(v) => handleChange('drivers_license_number', v)} error={errors.drivers_license_number} />
      <Input label="Driver's License State *" value={String(profile.drivers_license_state ?? '')} onChange={(v) => handleChange('drivers_license_state', v)} error={errors.drivers_license_state} />
      <Input label="Expiration Month *" type="number" min={1} max={12} value={numValue(profile.drivers_license_exp_month)} onChange={(v) => handleChange('drivers_license_exp_month', parseInt(v, 10) || null)} />
      <Input label="Expiration Day *" type="number" min={1} max={31} value={numValue(profile.drivers_license_exp_day)} onChange={(v) => handleChange('drivers_license_exp_day', parseInt(v, 10) || null)} />
      <Input label="Expiration Year *" type="number" min={1900} max={2100} value={numValue(profile.drivers_license_exp_year)} onChange={(v) => handleChange('drivers_license_exp_year', parseInt(v, 10) || null)} />
      </div>
    </div>
  );
}

function PersonalDetailsStep({ profile, handleChange, errors }: StepProps) {
  return (
    <div>
      <StepGuidance
        title="Personal Details"
        description="These details help us with safety compliance and matching you with appropriate trips."
      />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Input label="DOB Month *" type="number" min={1} max={12} value={numValue(profile.dob_month)} onChange={(v) => handleChange('dob_month', parseInt(v, 10) || null)} error={errors.dob_month} />
      <Input label="DOB Day *" type="number" min={1} max={31} value={numValue(profile.dob_day)} onChange={(v) => handleChange('dob_day', parseInt(v, 10) || null)} error={errors.dob_day} />
      <Input label="DOB Year *" type="number" min={1900} max={2100} value={numValue(profile.dob_year)} onChange={(v) => handleChange('dob_year', parseInt(v, 10) || null)} error={errors.dob_year} />
      <Input label="SSN *" value={String(profile.ssn ?? '')} onChange={(v) => handleChange('ssn', v)} error={errors.ssn} />
      <Input label="Hair Color *" value={String(profile.hair_color ?? '')} onChange={(v) => handleChange('hair_color', v)} />
      <Input label="Eye Color *" value={String(profile.eye_color ?? '')} onChange={(v) => handleChange('eye_color', v)} />
      <Input label="Height (Feet) *" type="number" min={0} max={8} value={numValue(profile.height_feet)} onChange={(v) => handleChange('height_feet', parseInt(v, 10) || null)} />
      <Input label="Height (Inches) *" type="number" min={0} max={11} value={numValue(profile.height_inches)} onChange={(v) => handleChange('height_inches', parseInt(v, 10) || null)} />
      <Input label="Weight (lbs) *" type="number" min={1} value={numValue(profile.weight_lbs)} onChange={(v) => handleChange('weight_lbs', parseInt(v, 10) || null)} />
      <Select label="Gender *" value={String(profile.gender ?? '')} onChange={(v) => handleChange('gender', v)} options={['Male', 'Female', 'Non-binary', 'Prefer not to say']} />
      </div>
    </div>
  );
}

function EmergencyStep({ profile, handleChange, errors }: StepProps) {
  return (
    <div>
      <StepGuidance
        title="Emergency Contact"
        description="In case of an emergency during a trip, we need someone we can contact quickly."
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Input label="First Name *" value={String(profile.emergency_contact_first_name ?? '')} onChange={(v) => handleChange('emergency_contact_first_name', v)} error={errors.emergency_contact_first_name} />
      <Input label="Last Name *" value={String(profile.emergency_contact_last_name ?? '')} onChange={(v) => handleChange('emergency_contact_last_name', v)} error={errors.emergency_contact_last_name} />
      <Input label="Phone Number *" value={String(profile.emergency_contact_phone ?? '')} onChange={(v) => handleChange('emergency_contact_phone', v)} error={errors.emergency_contact_phone} />
      <Select label="Phone Type *" value={String(profile.emergency_contact_phone_type ?? '')} onChange={(v) => handleChange('emergency_contact_phone_type', v)} options={['Mobile', 'Home', 'Work']} />
      <Input label="Relation *" value={String(profile.emergency_contact_relation ?? '')} onChange={(v) => handleChange('emergency_contact_relation', v)} placeholder="Spouse, Parent, Friend, etc." />
      </div>
    </div>
  );
}

function PhotoStep({
  profilePhotoUrl,
  profilePhotoStatus,
  profilePhotoRejectionReason,
  uploading,
  onUpload,
  onDelete,
}: {
  profilePhotoUrl: string | null;
  profilePhotoStatus: string | null | undefined;
  profilePhotoRejectionReason: string | null | undefined;
  uploading: boolean;
  onUpload: (file: File) => void;
  onDelete: () => void;
}) {
  return (
    <div className="py-4">
      <StepGuidance
        title="Profile Photo"
        description="A clear photo of yourself helps organizations identify you and builds trust with riders."
        centered
      />
      <ProfilePhotoUpload
        photoUrl={profilePhotoUrl}
        status={
          profilePhotoStatus === 'pending' ||
          profilePhotoStatus === 'approved' ||
          profilePhotoStatus === 'rejected'
            ? profilePhotoStatus
            : null
        }
        rejectionReason={profilePhotoRejectionReason}
        uploading={uploading}
        onUpload={onUpload}
        onDelete={onDelete}
        onboardingMode
      />
    </div>
  );
}

function VehicleStep({
  vehicleYear,
  vehicleMake,
  vehicleModel,
  passengerCapacity,
  seatingOverrideNote,
  onVehicleYearChange,
  onVehicleMakeChange,
  onVehicleModelChange,
  onPassengerCapacityChange,
  onSeatingOverrideNoteChange,
  capacitySuggestion,
  isCapacityOverride,
  seatingStatus,
  savingVehicle,
  vehicleMessage,
  onSaveVehicle,
  vehiclePhotoUrls,
  uploadingVehicle,
  onUploadVehiclePhotos,
  onDeleteVehiclePhoto,
  vehiclePhotoCount,
}: {
  vehicleYear: string;
  vehicleMake: string;
  vehicleModel: string;
  passengerCapacity: string;
  seatingOverrideNote: string;
  onVehicleYearChange: (v: string) => void;
  onVehicleMakeChange: (v: string) => void;
  onVehicleModelChange: (v: string) => void;
  onPassengerCapacityChange: (v: string) => void;
  onSeatingOverrideNoteChange: (v: string) => void;
  capacitySuggestion: CapacitySuggestion;
  isCapacityOverride: boolean;
  seatingStatus: string;
  savingVehicle: boolean;
  vehicleMessage: string | null;
  onSaveVehicle: () => void;
  vehiclePhotoUrls: string[];
  uploadingVehicle: boolean;
  onUploadVehiclePhotos: (files: FileList) => void;
  onDeleteVehiclePhoto: (index: number) => void;
  vehiclePhotoCount: number;
}) {
  return (
    <div className="space-y-8">
      <div>
        <StepGuidance
          title="Vehicle & Seating Capacity"
          description="We need your vehicle details and seating capacity so we can match you with the right trips and ensure safety compliance."
        />

        {seatingStatus === 'pending' && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-900">
            <strong>Pending admin approval.</strong> You cannot submit offers until your seating override is approved.
          </div>
        )}
        {seatingStatus === 'rejected' && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800">
            <strong>Override rejected.</strong> Update your capacity or explanation and save again.
          </div>
        )}

        <div className="grid sm:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-blue-950 mb-1">Year</label>
            <input type="number" min="1980" max={new Date().getFullYear() + 1} value={vehicleYear} onChange={(e) => onVehicleYearChange(e.target.value)} className="w-full border border-gray-300 rounded-xl px-3 py-2 text-blue-950" placeholder="2020" />
          </div>
          <div>
            <label className="block text-sm font-medium text-blue-950 mb-1">Make</label>
            <input type="text" value={vehicleMake} onChange={(e) => onVehicleMakeChange(e.target.value)} className="w-full border border-gray-300 rounded-xl px-3 py-2 text-blue-950" placeholder="Toyota" />
          </div>
          <div>
            <label className="block text-sm font-medium text-blue-950 mb-1">Model</label>
            <input type="text" value={vehicleModel} onChange={(e) => onVehicleModelChange(e.target.value)} className="w-full border border-gray-300 rounded-xl px-3 py-2 text-blue-950" placeholder="Sienna" />
          </div>
        </div>

        <div className={`mb-4 p-4 rounded-xl border ${capacitySuggestion.matched ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}`}>
          <p className="text-sm text-blue-900">{capacitySuggestion.message}</p>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-blue-950 mb-1">Passenger Capacity (excluding you)</label>
          <input type="number" min="1" max="50" value={passengerCapacity} onChange={(e) => onPassengerCapacityChange(e.target.value)} className="w-full max-w-xs border border-gray-300 rounded-xl px-3 py-2 text-blue-950" />
        </div>

        {isCapacityOverride && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-blue-950 mb-1">Why is your capacity different?</label>
            <textarea value={seatingOverrideNote} onChange={(e) => onSeatingOverrideNoteChange(e.target.value)} rows={3} className="w-full border border-gray-300 rounded-xl px-3 py-2 text-blue-950" placeholder="e.g. Third row removed for cargo" />
          </div>
        )}

        <button type="button" onClick={onSaveVehicle} disabled={savingVehicle} className="px-5 py-2.5 bg-[#1E3A8A] hover:bg-blue-900 text-white font-medium rounded-xl disabled:opacity-60">
          {savingVehicle ? 'Saving…' : 'Save Vehicle & Seating'}
        </button>
        {vehicleMessage && <p className="mt-3 text-sm text-blue-800">{vehicleMessage}</p>}
      </div>

      <div className="border-t pt-8">
        <h4 className="text-lg font-semibold text-blue-950 mb-4">Vehicle Photos (up to 5)</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
          {vehiclePhotoUrls.length > 0 ? (
            vehiclePhotoUrls.map((url, index) => (
              <div key={index} className="relative">
                <img src={url} alt={`Vehicle ${index + 1}`} className="w-full h-28 object-cover rounded-xl border border-gray-200" />
                <button type="button" onClick={() => onDeleteVehiclePhoto(index)} className="absolute top-1 right-1 bg-red-600 text-white text-xs px-1.5 py-0.5 rounded">✕</button>
              </div>
            ))
          ) : (
            <p className="col-span-full text-sm text-blue-800">No vehicle photos yet.</p>
          )}
        </div>
        {vehiclePhotoCount < 5 && (
          <label className="cursor-pointer inline-block px-4 py-2 border border-blue-300 text-blue-950 text-sm font-medium rounded-xl hover:bg-blue-50">
            {uploadingVehicle ? 'Uploading...' : '+ Add Vehicle Photo(s)'}
            <input type="file" accept="image/jpeg,image/png" multiple className="hidden" disabled={uploadingVehicle} onChange={(e) => e.target.files && onUploadVehiclePhotos(e.target.files)} />
          </label>
        )}
      </div>
    </div>
  );
}

function PaymentStep({
  isStripeConnected,
  hasStripeAccount,
  stripeConnecting,
  stripeMessage,
  onConnectStripe,
}: {
  isStripeConnected: boolean;
  hasStripeAccount: boolean;
  stripeConnecting: boolean;
  stripeMessage: string | null;
  onConnectStripe: () => void;
}) {
  return (
    <div className="text-center py-8">
      <StepGuidance
        title="Payment Setup (Stripe Connect)"
        description="Connect your Stripe Express account so you can get paid automatically when an organization marks a trip as complete."
        centered
      />

      {isStripeConnected ? (
        <div className="max-w-md mx-auto flex flex-col items-center gap-3 p-6 bg-green-50 border border-green-200 rounded-2xl">
          <span className="text-green-700 font-semibold text-lg">✓ Stripe Connected</span>
          <span className="text-sm text-green-600">Ready to receive payouts</span>
        </div>
      ) : hasStripeAccount ? (
        <div className="max-w-md mx-auto space-y-4">
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm">
            Stripe account created — complete onboarding to enable payouts.
          </div>
          <button
            type="button"
            onClick={onConnectStripe}
            disabled={stripeConnecting}
            className="bg-[#1E3A8A] text-white px-10 py-4 rounded-2xl hover:bg-[#162d6b] disabled:opacity-60"
          >
            {stripeConnecting ? 'Loading...' : 'Complete Stripe Setup'}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onConnectStripe}
          disabled={stripeConnecting}
          className="bg-[#1E3A8A] text-white px-10 py-4 rounded-2xl hover:bg-[#162d6b] disabled:opacity-60"
        >
          {stripeConnecting ? 'Connecting...' : 'Connect with Stripe'}
        </button>
      )}

      <p className="text-xs text-gray-500 mt-6">Secure • Fast payouts • No fees from Safe Ride Network</p>
      {stripeMessage && <p className="text-sm text-blue-800 mt-4">{stripeMessage}</p>}
    </div>
  );
}

function DocumentsStep({
  documentsUploaded,
  documentsRequired,
}: {
  documentsUploaded: number;
  documentsRequired: number;
}) {
  const pct = documentsRequired > 0 ? Math.round((documentsUploaded / documentsRequired) * 100) : 0;

  return (
    <div className="text-center py-8">
      <StepGuidance
        title="Required Documents"
        description="Upload your documents (license, insurance, background check, etc.) so we can verify you and activate your account."
        centered
      />
      <p className="text-gray-600 mb-2">
        {documentsUploaded} of {documentsRequired} uploadable documents submitted
      </p>
      <div className="max-w-md mx-auto h-2 bg-gray-100 rounded-full mb-8 overflow-hidden">
        <div className="h-2 bg-[#1E3A8A] transition-all" style={{ width: `${pct}%` }} />
      </div>
      <Link href="/dashboard/documents" className="inline-block bg-[#1E3A8A] text-white px-10 py-4 rounded-2xl hover:bg-[#162d6b]">
        Go to My Documents →
      </Link>
      <p className="text-sm text-gray-500 mt-6">
        Upload all required documents to activate your account. Background check is requested separately on the documents page.
      </p>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  error,
  ...props
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  error?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'>) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      <input
        {...props}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full border rounded-xl px-4 py-3 text-blue-950 focus:border-[#1E3A8A] focus:ring-1 focus:ring-[#1E3A8A] ${error ? 'border-red-500' : 'border-gray-300'}`}
      />
      {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
    </div>
  );
}

function Select({
  label,
  options,
  value,
  onChange,
  error,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full border rounded-xl px-4 py-3 text-blue-950 focus:border-[#1E3A8A] ${error ? 'border-red-500' : 'border-gray-300'}`}
      >
        <option value="">Select...</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
      {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
    </div>
  );
}