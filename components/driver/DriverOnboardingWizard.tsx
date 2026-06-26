'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import OperatingStatesStep, {
  type OperatingStatesSaveResult,
  type OperatingStatesStepHandle,
} from '@/components/driver/OperatingStatesStep';
import {
  DateOfBirthFields,
  FormInput,
  FormSelect,
  SsnFields,
  UsStateSelect,
  useDateOfBirthOptions,
} from '@/components/driver/WizardFormFields';
import { useRegisterWizardLeaveGuard } from '@/components/driver/WizardLeaveGuard';
import { calculateDriverCompletion } from '@/lib/driver/onboarding-completion';
import {
  GENDER_OPTIONS,
  HAIR_COLOR_OPTIONS,
  EYE_COLOR_OPTIONS,
  HEIGHT_FEET_OPTIONS,
  HEIGHT_INCHES_OPTIONS,
  MONTH_OPTIONS,
  PASSENGER_CAPACITY_OPTIONS,
  PHONE_TYPE_OPTIONS,
  getBirthYearOptions,
  getLicenseExpirationYearOptions,
  getVehicleYearOptions,
  reconcileDayAfterMonthYearChange,
  selectValue,
} from '@/lib/driver/wizard-form-options';
import {
  normalizeSsn,
  ssnRequiresVerification,
  validatePersonalDetailsStep,
} from '@/lib/driver/wizard-step-validation';
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

function formatLastSavedAt(date: Date): string {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export type DriverOnboardingWizardProps = {
  profile: PersonalProfile;
  onChange: (field: string, value: unknown) => void;
  /** Persist current step data before advancing. Return { ok: false } to stay on step. */
  onSaveStep: (
    step: number,
    options?: { resumeStep?: number }
  ) => Promise<WizardStepSaveResult>;
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

  const router = useRouter();
  const operatingStatesRef = useRef<OperatingStatesStepHandle>(null);
  const [savedSsnBaseline, setSavedSsnBaseline] = useState('');
  const [currentStep, setCurrentStep] = useState(clampWizardStep(initialStep));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [stepSaving, setStepSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveErrorContext, setSaveErrorContext] = useState<'step' | 'exit' | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [operatingStatesDirty, setOperatingStatesDirty] = useState(false);
  const [ssnVerify, setSsnVerify] = useState('');

  const hasUnsavedChangesOnStep =
    hasUnsavedChanges || (currentStep === 2 && operatingStatesDirty);

  const clearUnsavedChanges = useCallback(() => {
    setHasUnsavedChanges(false);
  }, []);

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

  useEffect(() => {
    setCurrentStep(clampWizardStep(initialStep));
  }, [initialStep]);

  useEffect(() => {
    if (currentStep !== 5) {
      setSsnVerify('');
      setSavedSsnBaseline('');
      return;
    }
    setSavedSsnBaseline(normalizeSsn(profile.ssn));
  }, [currentStep]);

  const showSsnVerify = ssnRequiresVerification(profile, savedSsnBaseline);

  const handleChange = (field: string, value: unknown) => {
    onChange(field, value);
    setHasUnsavedChanges(true);
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
    if (field === 'ssn' && errors.ssn_verify) {
      setErrors((prev) => ({ ...prev, ssn_verify: '' }));
    }
  };

  const handleSsnVerifyChange = (value: string) => {
    setSsnVerify(value);
    setHasUnsavedChanges(true);
    if (errors.ssn_verify) {
      setErrors((prev) => ({ ...prev, ssn_verify: '' }));
    }
  };

  const handleVehicleFieldChange = useCallback(
    (setter: (value: string) => void) => (value: string) => {
      setter(value);
      setHasUnsavedChanges(true);
    },
    []
  );

  const handlePassengerCapacityChange = useCallback(
    (value: string) => {
      onPassengerCapacityChange(value);
      setHasUnsavedChanges(true);
    },
    [onPassengerCapacityChange]
  );

  const validateStep = (step = currentStep) => {
    if (step >= 7) {
      setErrors({});
      return true;
    }

    const newErrors: Record<string, string> = {};

    if (step === 2) {
      const draftStates =
        step === currentStep
          ? operatingStatesRef.current?.getDraftStates() ??
            normalizeStateCodes(profile.driving_states as string[] | undefined)
          : normalizeStateCodes(profile.driving_states as string[] | undefined);
      if (draftStates.length === 0) {
        newErrors.driving_states = 'Select at least one operating state before continuing.';
      }
      setErrors(newErrors);
      return draftStates.length === 0 ? false : true;
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

    if (step === 5) {
      Object.assign(
        newErrors,
        validatePersonalDetailsStep(profile, ssnVerify, {
          savedSsnBaseline,
        })
      );
    } else {
      (WIZARD_STEP_FIELDS[step] || []).forEach((field) => {
        if (!hasValue(profile, field)) {
          newErrors[field] = 'This field is required';
        }
      });
    }

    if (step === 4) {
      const month = Number(profile.drivers_license_exp_month);
      const day = Number(profile.drivers_license_exp_day);
      const year = Number(profile.drivers_license_exp_year);
      if (month && day && year) {
        const expiration = new Date(year, month - 1, day);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (expiration <= today) {
          newErrors.drivers_license_exp_year =
            'License expiration must be a future date.';
        }
      }
    }

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

  const markSaveSuccess = (message = 'Progress saved.') => {
    clearUnsavedChanges();
    setLastSavedAt(new Date());
    setSaveSuccess(message);
  };

  const advanceToStep = async (next: number, message?: string) => {
    setCurrentStep(next);
    markSaveSuccess(message);
    await onStepAdvanced?.(next);
  };

  const handleValidationFailure = () => {
    if (currentStep === 8) {
      setSaveError('Please complete all required vehicle fields before continuing.');
    } else if (currentStep === 5) {
      setSaveError('Please complete all personal details and verify your SSN before continuing.');
    }
  };

  const saveCurrentStep = async (options?: {
    requireStates?: boolean;
    resumeStep?: number;
  }) => {
    if (currentStep === 2) {
      const statesResult = await operatingStatesRef.current?.save({
        requireStates: options?.requireStates ?? true,
      });
      if (!statesResult?.ok) {
        return statesResult ?? { ok: false, error: 'Unable to save operating states.' };
      }
    }

    return onSaveStep(currentStep, {
      resumeStep: options?.resumeStep ?? currentStep,
    });
  };

  const navigateToStep = async (
    targetStep: number,
    options?: { validateForward?: boolean; successMessage?: string }
  ) => {
    if (targetStep === currentStep || stepSaving) return;

    const isForward = targetStep > currentStep;
    setSaveError(null);
    setSaveErrorContext(null);
    setSaveSuccess(null);

    if (isForward && (options?.validateForward ?? true) && !validateStep()) {
      handleValidationFailure();
      return;
    }

    setStepSaving(true);
    try {
      const result = await saveCurrentStep({
        requireStates: isForward,
        resumeStep: targetStep,
      });
      if (!result.ok) {
        setSaveError(result.error);
        return;
      }

      await advanceToStep(targetStep, options?.successMessage);
    } finally {
      setStepSaving(false);
    }
  };

  const nextStep = async () => {
    if (currentStep >= WIZARD_STEPS.length) return;
    await navigateToStep(currentStep + 1, { validateForward: true });
  };

  const goToStep = async (targetStep: number) => {
    await navigateToStep(targetStep, { validateForward: targetStep > currentStep });
  };

  const prevStep = async () => {
    if (currentStep <= 1 || stepSaving) return;
    await navigateToStep(currentStep - 1, { validateForward: false });
  };

  const finishOnboarding = async () => {
    setSaveError(null);
    setSaveErrorContext(null);
    setSaveSuccess(null);
    setStepSaving(true);
    try {
      const result = await saveCurrentStep({ requireStates: true });
      if (!result.ok) {
        setSaveError(result.error);
        return;
      }
      markSaveSuccess(
        'Onboarding progress saved. Complete any remaining steps to activate your account.'
      );
      await onStepAdvanced?.(currentStep);
    } finally {
      setStepSaving(false);
    }
  };

  const saveAndExitRef = useRef<() => Promise<boolean>>(async () => false);
  saveAndExitRef.current = async () => {
    setSaveError(null);
    setSaveErrorContext(null);
    setSaveSuccess(null);
    setStepSaving(true);
    try {
      const result = await saveCurrentStep({ requireStates: false });
      if (!result.ok) {
        setSaveErrorContext('exit');
        setSaveError(result.error);
        return false;
      }
      markSaveSuccess('Your progress has been saved.');
      router.push('/dashboard?profileSaved=1');
      return true;
    } finally {
      setStepSaving(false);
    }
  };

  const saveAndExit = () => saveAndExitRef.current();

  const leaveGuardRegistration = useMemo(
    () => ({
      isDirty: hasUnsavedChangesOnStep && !stepSaving,
      saveAndExit: () => saveAndExitRef.current(),
    }),
    [hasUnsavedChangesOnStep, stepSaving]
  );

  useRegisterWizardLeaveGuard(leaveGuardRegistration);

  return (
    <div className="mb-8">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-8">
        <div>
          <h1 className="text-4xl font-bold text-gray-900">Complete Your Profile</h1>
          <p className="text-gray-600 mt-1">Finish all steps to activate your driver account</p>
          <div className="mt-2 space-y-1" aria-live="polite">
            {lastSavedAt && (
              <p className="text-sm text-emerald-700">
                Last saved at {formatLastSavedAt(lastSavedAt)}
              </p>
            )}
            {hasUnsavedChangesOnStep && !stepSaving && (
              <p className="text-sm text-amber-700">Unsaved changes on this step</p>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-3">
          <button
            type="button"
            onClick={() => void saveAndExit()}
            disabled={stepSaving}
            className="px-5 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-blue-950 hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {stepSaving ? 'Saving…' : 'Save & Exit'}
          </button>
          <div className="text-right">
            <div className="text-5xl font-bold text-[#1E3A8A]">{completion}%</div>
            <div className="text-sm text-gray-500">Complete</div>
          </div>
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
              ref={operatingStatesRef}
              variant="wizard"
              initialStates={(profile.driving_states as string[] | undefined) ?? []}
              onDirtyChange={setOperatingStatesDirty}
              onSaved={async (result) => {
                onChange('driving_states', result.drivingStates);
                setOperatingStatesDirty(false);
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
          <PersonalDetailsStep
            profile={profile}
            handleChange={handleChange}
            errors={errors}
            ssnVerify={ssnVerify}
            onSsnVerifyChange={handleSsnVerifyChange}
            showSsnVerify={showSsnVerify}
          />
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
            onVehicleYearChange={handleVehicleFieldChange(onVehicleYearChange)}
            onVehicleMakeChange={handleVehicleFieldChange(onVehicleMakeChange)}
            onVehicleModelChange={handleVehicleFieldChange(onVehicleModelChange)}
            onPassengerCapacityChange={handlePassengerCapacityChange}
            onSeatingOverrideNoteChange={handleVehicleFieldChange(onSeatingOverrideNoteChange)}
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
              {saveErrorContext === 'exit' ? (
                <>
                  <strong>Could not save before exiting.</strong> {saveError} You are still on this
                  step — fix the issue and try Save &amp; Exit again.
                </>
              ) : (
                <>
                  <strong>Could not save this step.</strong> {saveError} Your entries are still on
                  this page — fix the issue and try again.
                </>
              )}
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
          onClick={() => void prevStep()}
          disabled={currentStep === 1 || stepSaving}
          className="px-10 py-4 border border-gray-300 rounded-2xl text-blue-950 disabled:opacity-40 hover:bg-gray-50"
        >
          {stepSaving ? 'Saving…' : 'Previous'}
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
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <FormInput
          label="First Name *"
          value={String(profile.first_name ?? '')}
          onChange={(value) => handleChange('first_name', value)}
          error={errors.first_name}
          autoComplete="given-name"
        />
        <FormInput
          label="Last Name *"
          value={String(profile.last_name ?? '')}
          onChange={(value) => handleChange('last_name', value)}
          error={errors.last_name}
          autoComplete="family-name"
        />
        <FormInput
          label="Email Address *"
          type="email"
          value={String(profile.email ?? '')}
          onChange={(value) => handleChange('email', value)}
          error={errors.email}
          autoComplete="email"
        />
        <FormInput
          label="Phone Number *"
          type="tel"
          value={String(profile.phone ?? '')}
          onChange={(value) => handleChange('phone', value)}
          error={errors.phone}
          autoComplete="tel"
        />
        <FormSelect
          label="Phone Type *"
          value={selectValue(profile.phone_type)}
          onChange={(value) => handleChange('phone_type', value)}
          options={PHONE_TYPE_OPTIONS}
          error={errors.phone_type}
        />
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
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <FormInput
            label="Address Line 1 *"
            value={String(profile.physical_address_line1 ?? '')}
            onChange={(value) => handleChange('physical_address_line1', value)}
            error={errors.physical_address_line1}
            autoComplete="address-line1"
          />
          <FormInput
            label="Address Line 2"
            value={String(profile.physical_address_line2 ?? '')}
            onChange={(value) => handleChange('physical_address_line2', value)}
            autoComplete="address-line2"
          />
          <FormInput
            label="City *"
            value={String(profile.physical_city ?? '')}
            onChange={(value) => handleChange('physical_city', value)}
            error={errors.physical_city}
            autoComplete="address-level2"
          />
          <UsStateSelect
            label="State *"
            value={selectValue(profile.physical_state)}
            onChange={(value) => handleChange('physical_state', value)}
            error={errors.physical_state}
          />
          <FormInput
            label="Postal Code *"
            value={String(profile.physical_postal_code ?? '')}
            onChange={(value) => handleChange('physical_postal_code', value)}
            error={errors.physical_postal_code}
            autoComplete="postal-code"
          />
        </div>
      </div>
      <div>
        <h3 className="text-lg font-semibold text-[#1E3A8A] mb-4">Mailing Address</h3>
        <label className="flex items-center gap-3 mb-6 text-blue-950">
          <input type="checkbox" checked={mailingSame} onChange={(e) => handleChange('mailing_same_as_physical', e.target.checked)} />
          Mailing Address is the same as Physical Address
        </label>
        {!mailingSame && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <FormInput
              label="Mailing Address Line 1 *"
              value={String(profile.mailing_address_line1 ?? '')}
              onChange={(value) => handleChange('mailing_address_line1', value)}
              error={errors.mailing_address_line1}
            />
            <FormInput
              label="Mailing Address Line 2"
              value={String(profile.mailing_address_line2 ?? '')}
              onChange={(value) => handleChange('mailing_address_line2', value)}
            />
            <FormInput
              label="City *"
              value={String(profile.mailing_city ?? '')}
              onChange={(value) => handleChange('mailing_city', value)}
              error={errors.mailing_city}
            />
            <UsStateSelect
              label="State *"
              value={selectValue(profile.mailing_state)}
              onChange={(value) => handleChange('mailing_state', value)}
              error={errors.mailing_state}
            />
            <FormInput
              label="Postal Code *"
              value={String(profile.mailing_postal_code ?? '')}
              onChange={(value) => handleChange('mailing_postal_code', value)}
              error={errors.mailing_postal_code}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function LicenseStep({ profile, handleChange, errors }: StepProps) {
  const licenseDayOptions = useDateOfBirthOptions(
    profile.drivers_license_exp_month,
    profile.drivers_license_exp_year
  );
  const licenseYearOptions = useMemo(() => getLicenseExpirationYearOptions(), []);

  return (
    <div>
      <StepGuidance
        title="Driver's License"
        description="Your license information is required for background checks and to confirm you are legally allowed to drive."
      />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <FormInput
          label="Driver's License Number *"
          value={String(profile.drivers_license_number ?? '')}
          onChange={(value) => handleChange('drivers_license_number', value)}
          error={errors.drivers_license_number}
        />
        <UsStateSelect
          label="Driver's License State *"
          value={selectValue(profile.drivers_license_state)}
          onChange={(value) => handleChange('drivers_license_state', value)}
          error={errors.drivers_license_state}
        />
      </div>
      <div className="mt-6">
        <DateOfBirthFields
          groupLabel="License Expiration Date *"
          month={selectValue(profile.drivers_license_exp_month)}
          day={selectValue(profile.drivers_license_exp_day)}
          year={selectValue(profile.drivers_license_exp_year)}
          monthOptions={MONTH_OPTIONS}
          dayOptions={licenseDayOptions}
          yearOptions={licenseYearOptions}
          onMonthChange={(value) => {
            const month = value ? parseInt(value, 10) : null;
            handleChange('drivers_license_exp_month', month);
            const year = profile.drivers_license_exp_year as number | null;
            const nextDay = reconcileDayAfterMonthYearChange(
              profile.drivers_license_exp_day,
              month,
              typeof year === 'number' ? year : null
            );
            if (nextDay !== profile.drivers_license_exp_day) {
              handleChange('drivers_license_exp_day', nextDay);
            }
          }}
          onDayChange={(value) =>
            handleChange('drivers_license_exp_day', value ? parseInt(value, 10) : null)
          }
          onYearChange={(value) => {
            const year = value ? parseInt(value, 10) : null;
            handleChange('drivers_license_exp_year', year);
            const month = profile.drivers_license_exp_month as number | null;
            const nextDay = reconcileDayAfterMonthYearChange(
              profile.drivers_license_exp_day,
              typeof month === 'number' ? month : null,
              year
            );
            if (nextDay !== profile.drivers_license_exp_day) {
              handleChange('drivers_license_exp_day', nextDay);
            }
          }}
          error={
            errors.drivers_license_exp_month ||
            errors.drivers_license_exp_day ||
            errors.drivers_license_exp_year
          }
        />
      </div>
    </div>
  );
}

function PersonalDetailsStep({
  profile,
  handleChange,
  errors,
  ssnVerify,
  onSsnVerifyChange,
  showSsnVerify,
}: StepProps & {
  ssnVerify: string;
  onSsnVerifyChange: (value: string) => void;
  showSsnVerify: boolean;
}) {
  const birthYearOptions = useMemo(() => getBirthYearOptions(), []);
  const birthDayOptions = useDateOfBirthOptions(profile.dob_month, profile.dob_year);

  return (
    <div className="space-y-8">
      <StepGuidance
        title="Personal Details"
        description="These details help us with safety compliance and matching you with appropriate trips."
      />

      <DateOfBirthFields
        month={selectValue(profile.dob_month)}
        day={selectValue(profile.dob_day)}
        year={selectValue(profile.dob_year)}
        monthOptions={MONTH_OPTIONS}
        dayOptions={birthDayOptions}
        yearOptions={birthYearOptions}
        onMonthChange={(value) => {
          const month = value ? parseInt(value, 10) : null;
          handleChange('dob_month', month);
          const year = profile.dob_year as number | null;
          const nextDay = reconcileDayAfterMonthYearChange(
            profile.dob_day,
            month,
            typeof year === 'number' ? year : null
          );
          if (nextDay !== profile.dob_day) {
            handleChange('dob_day', nextDay);
          }
        }}
        onDayChange={(value) => handleChange('dob_day', value ? parseInt(value, 10) : null)}
        onYearChange={(value) => {
          const year = value ? parseInt(value, 10) : null;
          handleChange('dob_year', year);
          const month = profile.dob_month as number | null;
          const nextDay = reconcileDayAfterMonthYearChange(
            profile.dob_day,
            typeof month === 'number' ? month : null,
            year
          );
          if (nextDay !== profile.dob_day) {
            handleChange('dob_day', nextDay);
          }
        }}
        error={errors.dob}
      />

      <SsnFields
        ssn={selectValue(profile.ssn)}
        ssnVerify={ssnVerify}
        onSsnChange={(value) => handleChange('ssn', value)}
        onSsnVerifyChange={onSsnVerifyChange}
        ssnError={errors.ssn}
        ssnVerifyError={errors.ssn_verify}
        showVerify={showSsnVerify}
        ssnOnFile={!showSsnVerify && Boolean(selectValue(profile.ssn))}
      />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <FormSelect
          label="Hair Color *"
          value={selectValue(profile.hair_color)}
          onChange={(value) => handleChange('hair_color', value)}
          options={HAIR_COLOR_OPTIONS}
          error={errors.hair_color}
        />
        <FormSelect
          label="Eye Color *"
          value={selectValue(profile.eye_color)}
          onChange={(value) => handleChange('eye_color', value)}
          options={EYE_COLOR_OPTIONS}
          error={errors.eye_color}
        />
        <FormSelect
          label="Height (Feet) *"
          value={selectValue(profile.height_feet)}
          onChange={(value) =>
            handleChange('height_feet', value ? parseInt(value, 10) : null)
          }
          options={HEIGHT_FEET_OPTIONS}
          error={errors.height_feet}
        />
        <FormSelect
          label="Height (Inches) *"
          value={selectValue(profile.height_inches)}
          onChange={(value) =>
            handleChange('height_inches', value ? parseInt(value, 10) : null)
          }
          options={HEIGHT_INCHES_OPTIONS}
          error={errors.height_inches}
        />
        <FormInput
          label="Weight (lbs) *"
          type="number"
          min={50}
          max={500}
          value={numValue(profile.weight_lbs)}
          onChange={(value) => handleChange('weight_lbs', value ? parseInt(value, 10) : null)}
          error={errors.weight_lbs}
        />
        <FormSelect
          label="Gender *"
          value={selectValue(profile.gender)}
          onChange={(value) => handleChange('gender', value)}
          options={GENDER_OPTIONS}
          error={errors.gender}
        />
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
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <FormInput
          label="First Name *"
          value={String(profile.emergency_contact_first_name ?? '')}
          onChange={(value) => handleChange('emergency_contact_first_name', value)}
          error={errors.emergency_contact_first_name}
        />
        <FormInput
          label="Last Name *"
          value={String(profile.emergency_contact_last_name ?? '')}
          onChange={(value) => handleChange('emergency_contact_last_name', value)}
          error={errors.emergency_contact_last_name}
        />
        <FormInput
          label="Phone Number *"
          type="tel"
          value={String(profile.emergency_contact_phone ?? '')}
          onChange={(value) => handleChange('emergency_contact_phone', value)}
          error={errors.emergency_contact_phone}
        />
        <FormSelect
          label="Phone Type *"
          value={selectValue(profile.emergency_contact_phone_type)}
          onChange={(value) => handleChange('emergency_contact_phone_type', value)}
          options={PHONE_TYPE_OPTIONS}
          error={errors.emergency_contact_phone_type}
        />
        <FormInput
          label="Relation *"
          value={String(profile.emergency_contact_relation ?? '')}
          onChange={(value) => handleChange('emergency_contact_relation', value)}
          placeholder="Spouse, Parent, Friend, etc."
          error={errors.emergency_contact_relation}
        />
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

        <div className="mb-4 grid gap-4 sm:grid-cols-3">
          <FormSelect
            label="Year *"
            value={vehicleYear}
            onChange={onVehicleYearChange}
            options={getVehicleYearOptions()}
            placeholder="Select year"
          />
          <FormInput
            label="Make *"
            value={vehicleMake}
            onChange={onVehicleMakeChange}
            placeholder="Toyota"
          />
          <FormInput
            label="Model *"
            value={vehicleModel}
            onChange={onVehicleModelChange}
            placeholder="Sienna"
          />
        </div>

        <div className={`mb-4 p-4 rounded-xl border ${capacitySuggestion.matched ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}`}>
          <p className="text-sm text-blue-900">{capacitySuggestion.message}</p>
        </div>

        <div className="mb-4 max-w-xs">
          <FormSelect
            label="Passenger Capacity (excluding you) *"
            value={passengerCapacity}
            onChange={onPassengerCapacityChange}
            options={PASSENGER_CAPACITY_OPTIONS}
            placeholder="Select capacity"
          />
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

