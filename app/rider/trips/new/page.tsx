'use client';

/**
 * Trip request wizard — 5 steps ending in Stripe Checkout.
 * Phase 2: Supabase draft persistence; admin surge pricing rules.
 */

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { authFetch } from '@/lib/auth-fetch';
import { calculateTripPrice, type PriceBreakdown } from '@/lib/pricing';
import { clearRiderTripDraft, draftToWizardFields, getRiderTripDraft } from '@/lib/rider/trip-draft';
import LocationPicker, { type LatLngCoords, type RouteEstimate } from '@/components/maps/LocationPicker';
import RiderBackLink from '@/components/rider/RiderBackLink';
import RiderTrustBanner from '@/components/rider/RiderTrustBanner';
import {
  ASAP_EXPECTATIONS,
  CONTRACTOR_DISCLAIMER,
  getAsapPickupIso,
  formatScheduleLabel,
  SCHEDULED_EXPECTATIONS,
  type ScheduleMode,
} from '@/lib/rider/schedule';

type MatchingMode = 'auto_first_offer' | 'manual_review';

const STEPS = [
  { id: 1, label: 'Location' },
  { id: 2, label: 'Schedule' },
  { id: 3, label: 'Details' },
  { id: 4, label: 'Matching' },
  { id: 5, label: 'Review' },
] as const;

const labelClass = 'block text-sm font-semibold text-blue-950 mb-2';
const inputClass =
  'w-full rounded-xl border border-blue-200 px-4 py-3 text-blue-950 placeholder:text-blue-400 focus:border-[#1E3A8A] focus:outline-none focus:ring-2 focus:ring-blue-200';
const textareaClass = `${inputClass} resize-y min-h-[100px]`;

/** Cancel & Refund Policy — Rider Portal Spec v1.1 */
const CANCEL_REFUND_POLICY = [
  'Full refund if you cancel more than 24 hours before your scheduled pickup time.',
  '50% refund if you cancel between 2 and 24 hours before pickup.',
  'No refund if you cancel less than 2 hours before pickup or after your driver is en route.',
  'Auto-match: when a driver is assigned, you have 60 seconds to confirm or cancel the match without penalty.',
  'Refunds are processed to your original payment method within 5–10 business days.',
];

type FormState = {
  pickupLocation: string;
  dropoffLocation: string;
  scheduleMode: ScheduleMode;
  pickupDate: string;
  pickupTime: string;
  passengers: string;
  accessibilityNeeds: string;
  specialInstructions: string;
  matchingMode: MatchingMode;
  policyAcknowledged: boolean;
};

const initialForm: FormState = {
  pickupLocation: '',
  dropoffLocation: '',
  scheduleMode: 'scheduled',
  pickupDate: '',
  pickupTime: '',
  passengers: '1',
  accessibilityNeeds: '',
  specialInstructions: '',
  matchingMode: 'auto_first_offer',
  policyAcknowledged: false,
};

function RiderTripWizard() {
  const searchParams = useSearchParams();
  const cancelled = searchParams.get('cancelled') === 'true';

  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(initialForm);
  const [stepError, setStepError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [loading, setLoading] = useState(false);
  const [priceLoading, setPriceLoading] = useState(false);
  const [breakdown, setBreakdown] = useState<PriceBreakdown | null>(null);
  const [distanceMiles, setDistanceMiles] = useState<number | null>(null);
  const [routeDurationMinutes, setRouteDurationMinutes] = useState<number | null>(null);
  const [pickupCoords, setPickupCoords] = useState<LatLngCoords | null>(null);
  const [dropoffCoords, setDropoffCoords] = useState<LatLngCoords | null>(null);
  const [draftLoaded, setDraftLoaded] = useState(false);

  // Pre-fill wizard from Get a Ride conversion funnel (sessionStorage)
  useEffect(() => {
    const draft = getRiderTripDraft();
    if (draft) {
      const fields = draftToWizardFields(draft);
      setForm((prev) => ({
        ...prev,
        ...fields,
      }));
      setDraftLoaded(true);
    }
  }, []);

  // Load rider's default matching preference from profile
  useEffect(() => {
    const loadProfile = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('default_matching_mode, rider_accessibility_notes')
        .eq('id', user.id)
        .single();

      setForm((prev) => {
        const next = { ...prev };
        if (
          profile?.default_matching_mode === 'auto_first_offer' ||
          profile?.default_matching_mode === 'manual_review'
        ) {
          next.matchingMode = profile.default_matching_mode;
        }
        if (!prev.accessibilityNeeds.trim() && profile?.rider_accessibility_notes) {
          next.accessibilityNeeds = profile.rider_accessibility_notes;
        }
        return next;
      });
    };
    loadProfile();
  }, []);

  const pickupDateTimeIso = useMemo(() => {
    if (form.scheduleMode === 'asap') {
      return getAsapPickupIso();
    }
    if (!form.pickupDate || !form.pickupTime) return null;
    return new Date(`${form.pickupDate}T${form.pickupTime}`).toISOString();
  }, [form.scheduleMode, form.pickupDate, form.pickupTime]);

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setStepError('');
  };

  const handlePickupLocationChange = (address: string, coords: LatLngCoords | null) => {
    setForm((prev) => ({ ...prev, pickupLocation: address }));
    setPickupCoords(coords);
    setStepError('');
    if (!coords) {
      setDistanceMiles(null);
      setRouteDurationMinutes(null);
    }
  };

  const handleDropoffLocationChange = (address: string, coords: LatLngCoords | null) => {
    setForm((prev) => ({ ...prev, dropoffLocation: address }));
    setDropoffCoords(coords);
    setStepError('');
    if (!coords) {
      setDistanceMiles(null);
      setRouteDurationMinutes(null);
    }
  };

  const handleRouteEstimate = useCallback((estimate: RouteEstimate | null) => {
    if (estimate) {
      setDistanceMiles(estimate.distanceMiles);
      setRouteDurationMinutes(estimate.durationMinutes);
    } else if (!pickupCoords || !dropoffCoords) {
      setDistanceMiles(null);
      setRouteDurationMinutes(null);
    }
  }, [pickupCoords, dropoffCoords]);

  /** Estimate price using route distance (from picker) or distance API + pricing engine */
  const estimatePrice = useCallback(async () => {
    if (!form.pickupLocation.trim() || !form.dropoffLocation.trim()) return;

    setPriceLoading(true);
    setSubmitError('');

    try {
      let miles = distanceMiles;

      if (miles == null) {
        const origin =
          pickupCoords != null
            ? `${pickupCoords.lat},${pickupCoords.lng}`
            : form.pickupLocation.trim();
        const destination =
          dropoffCoords != null
            ? `${dropoffCoords.lat},${dropoffCoords.lng}`
            : form.dropoffLocation.trim();

        const distRes = await fetch('/api/maps/distance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ origin, destination }),
        });

        const distData = await distRes.json();
        if (!distRes.ok) {
          throw new Error(distData.error || 'Could not calculate distance');
        }

        miles = distData.distanceMiles;
        setDistanceMiles(miles);
        if (typeof distData.durationMinutes === 'number') {
          setRouteDurationMinutes(distData.durationMinutes);
        }
      }

      if (miles == null) {
        throw new Error('Could not determine trip distance.');
      }

      const pickupTime = pickupDateTimeIso ?? new Date().toISOString();
      const priceCalc = await calculateTripPrice(miles, pickupTime);
      setBreakdown(priceCalc);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Price estimate failed';
      // Fallback estimate when Maps API is unavailable (Phase 2: configurable default distance)
      const fallbackMiles = 10;
      setDistanceMiles(fallbackMiles);
      const fallback = await calculateTripPrice(fallbackMiles, pickupDateTimeIso ?? new Date());
      setBreakdown(fallback);
      setSubmitError(`Using estimated pricing: ${message}`);
    } finally {
      setPriceLoading(false);
    }
  }, [
    form.pickupLocation,
    form.dropoffLocation,
    pickupCoords,
    dropoffCoords,
    distanceMiles,
    pickupDateTimeIso,
  ]);

  // Refresh price estimate when entering review step or when schedule changes on step 5
  useEffect(() => {
    if (step === 5) {
      estimatePrice();
    }
  }, [step, estimatePrice]);

  const validateStep = (currentStep: number): string | null => {
    switch (currentStep) {
      case 1: {
        if (!form.pickupLocation.trim()) return 'Pickup location is required.';
        if (!form.dropoffLocation.trim()) return 'Drop-off location is required.';
        if (form.pickupLocation.trim().toLowerCase() === form.dropoffLocation.trim().toLowerCase()) {
          return 'Pickup and drop-off must be different.';
        }
        if (
          pickupCoords &&
          dropoffCoords &&
          Math.abs(pickupCoords.lat - dropoffCoords.lat) < 0.0001 &&
          Math.abs(pickupCoords.lng - dropoffCoords.lng) < 0.0001
        ) {
          return 'Pickup and drop-off must be different locations.';
        }
        if (!pickupCoords || !dropoffCoords) {
          return 'Select each location from search suggestions or tap the map so we can route your trip.';
        }
        return null;
      }
      case 2:
        if (form.scheduleMode === 'asap') {
          return null;
        }
        if (!form.pickupDate) return 'Pickup date is required.';
        if (!form.pickupTime) return 'Pickup time is required.';
        if (!pickupDateTimeIso) return 'Invalid date or time.';
        if (new Date(pickupDateTimeIso).getTime() < Date.now()) {
          return 'Pickup must be scheduled in the future.';
        }
        return null;
      case 3: {
        const pax = parseInt(form.passengers, 10);
        if (Number.isNaN(pax) || pax < 1 || pax > 8) return 'Passengers must be between 1 and 8.';
        return null;
      }
      case 4:
        return null;
      case 5:
        if (!form.policyAcknowledged) return 'You must acknowledge the cancel and refund policy.';
        if (!breakdown) return 'Price estimate is still loading. Please wait.';
        return null;
      default:
        return null;
    }
  };

  const goNext = async () => {
    const err = validateStep(step);
    if (err) {
      setStepError(err);
      return;
    }
    setStepError('');
    if (step < 5) {
      setStep(step + 1);
    }
  };

  const goBack = () => {
    setStepError('');
    if (step > 1) setStep(step - 1);
  };

  const handleSubmit = async () => {
    const err = validateStep(5);
    if (err) {
      setStepError(err);
      return;
    }

    if (!breakdown || !pickupDateTimeIso) return;

    setLoading(true);
    setSubmitError('');
    setStepError('');

    try {
      const policyAcknowledgedAt = new Date().toISOString();

      const descriptionParts = [
        form.specialInstructions.trim(),
        form.accessibilityNeeds.trim() ? `Accessibility: ${form.accessibilityNeeds.trim()}` : '',
      ].filter(Boolean);

      const resolvedPickupTime =
        form.scheduleMode === 'asap' ? getAsapPickupIso() : pickupDateTimeIso;

      const tripPayload: Record<string, unknown> = {
        pickup_location: form.pickupLocation.trim(),
        dropoff_location: form.dropoffLocation.trim(),
        pickup_time: resolvedPickupTime,
        schedule_mode: form.scheduleMode,
        passengers: parseInt(form.passengers, 10) || 1,
        description: descriptionParts.length > 0 ? descriptionParts.join('\n\n') : null,
        accessibility_notes: form.accessibilityNeeds.trim() || null,
        matching_mode: form.matchingMode,
        policy_acknowledged_at: policyAcknowledgedAt,
        distance_miles: distanceMiles,
        base_price: breakdown.basePrice,
        peak_multiplier: breakdown.peakMultiplier,
        calculated_price: breakdown.driverCompensation,
        final_price: breakdown.driverCompensation,
        platform_fee: breakdown.platformFee,
        total_price: breakdown.totalPrice,
      };

      if (pickupCoords) {
        tripPayload.start_lat = pickupCoords.lat;
        tripPayload.start_lng = pickupCoords.lng;
      }
      if (dropoffCoords) {
        tripPayload.end_lat = dropoffCoords.lat;
        tripPayload.end_lng = dropoffCoords.lng;
      }

      const response = await authFetch('/api/rider/create-checkout-session', {
        method: 'POST',
        body: JSON.stringify({ trip: tripPayload }),
      });

      const data = await response.json();

      if (!response.ok) {
        const detail = data.details ? ` (${data.details})` : '';
        throw new Error((data.error || `Checkout failed (${response.status})`) + detail);
      }

      if (data.url) {
        clearRiderTripDraft();
        window.location.href = data.url;
      } else {
        throw new Error('Stripe did not return a checkout URL.');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to submit ride request';
      setSubmitError(message);
    } finally {
      setLoading(false);
    }
  };

  const minDate = new Date().toISOString().split('T')[0];

  return (
    <div className="mx-auto max-w-2xl pb-8">
      <RiderBackLink href="/rider/dashboard" label="Back to dashboard" />

      <h1 className="text-3xl font-bold text-blue-950">Request a Ride</h1>
      <p className="mt-2 text-blue-800">
        Step {step} of {STEPS.length} — {STEPS[step - 1].label}
      </p>

      {draftLoaded && (
        <div className="mt-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
          We&apos;ve pre-filled your trip from Get a Ride. Review the details below and continue to payment.
        </div>
      )}

      {cancelled && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">Payment cancelled</p>
          <p className="mt-1">No charge was made. Review your trip details below and continue to checkout when ready.</p>
        </div>
      )}

      {step === 5 && <RiderTrustBanner className="mt-4" />}

      {/* Progress indicator */}
      <nav aria-label="Wizard progress" className="mt-6">
        <ol className="flex items-center justify-between gap-1 sm:gap-2">
          {STEPS.map((s) => (
            <li key={s.id} className="flex flex-1 flex-col items-center">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold sm:h-9 sm:w-9 sm:text-sm ${
                  s.id < step
                    ? 'bg-[#1E3A8A] text-white'
                    : s.id === step
                      ? 'bg-[#1E3A8A] text-white ring-4 ring-blue-100'
                      : 'bg-blue-100 text-blue-700'
                }`}
              >
                {s.id}
              </div>
              <span
                className={`mt-1 hidden text-center text-xs sm:block ${
                  s.id === step ? 'font-semibold text-blue-950' : 'text-blue-700'
                }`}
              >
                {s.label}
              </span>
            </li>
          ))}
        </ol>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-blue-100">
          <div
            className="h-full rounded-full bg-[#1E3A8A] transition-all duration-300"
            style={{ width: `${((step - 1) / (STEPS.length - 1)) * 100}%` }}
          />
        </div>
      </nav>

      <div className="mt-8 rounded-2xl border border-blue-200 bg-white p-5 shadow-sm sm:p-8">
        {/* Step 1: Location */}
        {step === 1 && (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold text-blue-950">Where are you going?</h2>
            <LocationPicker
              pickupAddress={form.pickupLocation}
              dropoffAddress={form.dropoffLocation}
              pickupCoords={pickupCoords}
              dropoffCoords={dropoffCoords}
              onPickupChange={handlePickupLocationChange}
              onDropoffChange={handleDropoffLocationChange}
              onRouteEstimate={handleRouteEstimate}
              inputClassName={inputClass}
              labelClassName={labelClass}
              mapHeight={380}
              heading="Pickup & drop-off"
              helperText="Search addresses or tap the map to place pickup (P) then dropoff (D). Drag markers to adjust."
            />
          </div>
        )}

        {/* Step 2: Schedule */}
        {step === 2 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-blue-950">When do you need pickup?</h2>
              <p className="mt-1 text-sm text-blue-800">
                Choose how soon you need a ride. {CONTRACTOR_DISCLAIMER}
              </p>
            </div>

            <div className="space-y-3" role="radiogroup" aria-label="Pickup schedule">
              <label
                className={`block cursor-pointer rounded-2xl border-2 p-4 transition sm:p-5 ${
                  form.scheduleMode === 'asap'
                    ? 'border-[#1E3A8A] bg-blue-50'
                    : 'border-blue-200 hover:border-blue-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="scheduleMode"
                    checked={form.scheduleMode === 'asap'}
                    onChange={() => updateField('scheduleMode', 'asap')}
                    className="mt-1 h-4 w-4 accent-[#1E3A8A]"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-blue-950">{ASAP_EXPECTATIONS.title}</p>
                    <p className="mt-1 text-sm text-blue-800">{ASAP_EXPECTATIONS.summary}</p>
                  </div>
                </div>
              </label>

              <label
                className={`block cursor-pointer rounded-2xl border-2 p-4 transition sm:p-5 ${
                  form.scheduleMode === 'scheduled'
                    ? 'border-[#1E3A8A] bg-blue-50'
                    : 'border-blue-200 hover:border-blue-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="scheduleMode"
                    checked={form.scheduleMode === 'scheduled'}
                    onChange={() => updateField('scheduleMode', 'scheduled')}
                    className="mt-1 h-4 w-4 accent-[#1E3A8A]"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-blue-950">{SCHEDULED_EXPECTATIONS.title}</p>
                    <p className="mt-1 text-sm text-blue-800">{SCHEDULED_EXPECTATIONS.summary}</p>
                  </div>
                </div>
              </label>
            </div>

            {form.scheduleMode === 'asap' ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4">
                <p className="text-sm font-semibold text-amber-950">What to expect</p>
                <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-amber-900">
                  {ASAP_EXPECTATIONS.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
                <p className="mt-3 text-sm text-amber-900">{ASAP_EXPECTATIONS.reassurance}</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="pickupDate" className={labelClass}>
                      Date
                    </label>
                    <input
                      id="pickupDate"
                      type="date"
                      value={form.pickupDate}
                      min={minDate}
                      onChange={(e) => updateField('pickupDate', e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="pickupTime" className={labelClass}>
                      Time
                    </label>
                    <input
                      id="pickupTime"
                      type="time"
                      value={form.pickupTime}
                      onChange={(e) => updateField('pickupTime', e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>
                <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
                  <p className="text-sm font-medium text-blue-950">Scheduled pickup notes</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-blue-800">
                    {SCHEDULED_EXPECTATIONS.points.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Details */}
        {step === 3 && (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold text-blue-950">Trip details</h2>
            <div>
              <label htmlFor="passengers" className={labelClass}>
                Number of passengers
              </label>
              <select
                id="passengers"
                value={form.passengers}
                onChange={(e) => updateField('passengers', e.target.value)}
                className={inputClass}
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <option key={n} value={String(n)}>
                    {n} {n === 1 ? 'passenger' : 'passengers'}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="accessibility" className={labelClass}>
                Accessibility needs
              </label>
              <textarea
                id="accessibility"
                value={form.accessibilityNeeds}
                onChange={(e) => updateField('accessibilityNeeds', e.target.value)}
                placeholder="Wheelchair access, service animal, extra assistance, etc."
                className={textareaClass}
              />
            </div>
            <div>
              <label htmlFor="instructions" className={labelClass}>
                Special instructions
              </label>
              <textarea
                id="instructions"
                value={form.specialInstructions}
                onChange={(e) => updateField('specialInstructions', e.target.value)}
                placeholder="Building entrance, contact on arrival, luggage, etc."
                className={textareaClass}
              />
            </div>
          </div>
        )}

        {/* Step 4: Matching preference */}
        {step === 4 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-blue-950">How should we match your driver?</h2>
            {(
              [
                {
                  value: 'auto_first_offer' as MatchingMode,
                  title: 'Auto-match first driver',
                  description:
                    'The first available vetted driver is assigned automatically. You have 60 seconds to confirm or cancel.',
                },
                {
                  value: 'manual_review' as MatchingMode,
                  title: 'Review offers manually',
                  description:
                    'Drivers submit offers for your trip. You choose the driver that works best for you.',
                },
              ] as const
            ).map((option) => (
              <label
                key={option.value}
                className={`block cursor-pointer rounded-2xl border-2 p-4 transition sm:p-5 ${
                  form.matchingMode === option.value
                    ? 'border-[#1E3A8A] bg-blue-50'
                    : 'border-blue-200 hover:border-blue-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="matchingMode"
                    checked={form.matchingMode === option.value}
                    onChange={() => updateField('matchingMode', option.value)}
                    className="mt-1 h-4 w-4 accent-[#1E3A8A]"
                  />
                  <div>
                    <p className="font-semibold text-blue-950">{option.title}</p>
                    <p className="mt-1 text-sm text-blue-800">{option.description}</p>
                  </div>
                </div>
              </label>
            ))}
          </div>
        )}

        {/* Step 5: Review + Policy + Payment */}
        {step === 5 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-blue-950">Review your ride request</h2>

            <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm">
              <dl className="space-y-2">
                <div className="flex justify-between gap-4">
                  <dt className="text-blue-800">Pickup</dt>
                  <dd className="text-right font-medium text-blue-950">{form.pickupLocation}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-blue-800">Drop-off</dt>
                  <dd className="text-right font-medium text-blue-950">{form.dropoffLocation}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-blue-800">When</dt>
                  <dd className="text-right font-medium text-blue-950">
                    {formatScheduleLabel(form.scheduleMode, pickupDateTimeIso)}
                  </dd>
                </div>
                {form.scheduleMode === 'asap' && pickupDateTimeIso && (
                  <div className="flex justify-between gap-4 text-xs">
                    <dt className="text-blue-700">Target window</dt>
                    <dd className="text-right text-blue-800">
                      ~{new Date(pickupDateTimeIso).toLocaleTimeString(undefined, {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}{' '}
                      (estimate, not guaranteed)
                    </dd>
                  </div>
                )}
                <div className="flex justify-between gap-4">
                  <dt className="text-blue-800">Passengers</dt>
                  <dd className="font-medium text-blue-950">{form.passengers}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-blue-800">Matching</dt>
                  <dd className="text-right font-medium text-blue-950">
                    {form.matchingMode === 'auto_first_offer' ? 'Auto-match' : 'Manual review'}
                  </dd>
                </div>
              </dl>
            </div>

            <div
              className={`rounded-xl border p-4 ${
                form.scheduleMode === 'asap'
                  ? 'border-amber-200 bg-amber-50/70'
                  : 'border-blue-100 bg-blue-50/60'
              }`}
            >
              <h3 className="font-semibold text-blue-950">Pickup expectations</h3>
              {form.scheduleMode === 'asap' ? (
                <>
                  <p className="mt-2 text-sm text-blue-900">
                    <strong>We do not guarantee immediate pickup.</strong> Your request will be
                    sent to independent contractor drivers in your area. The closest available driver
                    will be assigned as soon as possible after payment.
                  </p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-blue-800">
                    {ASAP_EXPECTATIONS.points.slice(1).map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                </>
              ) : (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-blue-800">
                  <li>{SCHEDULED_EXPECTATIONS.summary}</li>
                  {SCHEDULED_EXPECTATIONS.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-xs text-blue-700">{CONTRACTOR_DISCLAIMER}</p>
            </div>

            {/* Price estimate */}
            <div className="rounded-xl border border-blue-200 bg-white p-4">
              <h3 className="font-semibold text-blue-950">Estimated price</h3>
              {priceLoading ? (
                <p className="mt-2 text-sm text-blue-800">Calculating...</p>
              ) : breakdown ? (
                <dl className="mt-3 space-y-1 text-sm">
                  {distanceMiles != null && (
                    <div className="flex justify-between text-blue-800">
                      <dt>Distance</dt>
                      <dd>
                        {distanceMiles} mi
                        {routeDurationMinutes != null && routeDurationMinutes > 0
                          ? ` (~${routeDurationMinutes} min drive)`
                          : ''}
                      </dd>
                    </div>
                  )}
                  <div className="flex justify-between text-blue-800">
                    <dt>Driver compensation</dt>
                    <dd>${breakdown.driverCompensation.toFixed(2)}</dd>
                  </div>
                  <div className="flex justify-between text-blue-800">
                    <dt>Platform fee ({(breakdown.platformFeePercent * 100).toFixed(0)}%)</dt>
                    <dd>${breakdown.platformFee.toFixed(2)}</dd>
                  </div>
                  {breakdown.isPeakTime && (
                    <div className="flex justify-between text-amber-800">
                      <dt>Peak pricing</dt>
                      <dd>{breakdown.peakMultiplier}x</dd>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-blue-100 pt-2 text-base font-semibold text-blue-950">
                    <dt>Total due today</dt>
                    <dd>${breakdown.totalPrice.toFixed(2)}</dd>
                  </div>
                </dl>
              ) : (
                <p className="mt-2 text-sm text-blue-800">Price unavailable — check your locations.</p>
              )}
              <p className="mt-2 text-xs text-blue-700">
                {/* Phase 2: Live pricing from admin settings + surge rules */}
                Final price is calculated from distance and schedule. Taxes may apply.
              </p>
            </div>

            {/* Cancel & Refund Policy */}
            <div className="rounded-xl border border-blue-200 p-4">
              <h3 className="font-semibold text-blue-950">Cancel &amp; Refund Policy</h3>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-blue-800">
                {CANCEL_REFUND_POLICY.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <label className="mt-4 flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={form.policyAcknowledged}
                  onChange={(e) => updateField('policyAcknowledged', e.target.checked)}
                  className="mt-1 h-4 w-4 rounded accent-[#1E3A8A]"
                />
                <span className="text-sm text-blue-950">
                  I have read and agree to the Cancel &amp; Refund Policy before completing payment.
                </span>
              </label>
            </div>
          </div>
        )}

        {(stepError || submitError) && (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {stepError || submitError}
          </p>
        )}
      </div>

      {/* Navigation */}
      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <button
          type="button"
          onClick={goBack}
          disabled={step === 1 || loading}
          className="rounded-xl border border-blue-200 px-6 py-3 text-sm font-medium text-blue-950 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Back
        </button>

        {step < 5 ? (
          <button
            type="button"
            onClick={goNext}
            className="rounded-xl bg-[#1E3A8A] px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-900"
          >
            Continue
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || priceLoading || !form.policyAcknowledged}
            className="rounded-xl bg-[#1E3A8A] px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? 'Redirecting to payment...' : 'Pay & Request Ride'}
          </button>
        )}
      </div>
    </div>
  );
}

export default function RiderNewTripPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-blue-800">Loading wizard...</div>
      }
    >
      <RiderTripWizard />
    </Suspense>
  );
}