import { supabase } from '@/lib/supabase';

export interface PeakRule {
  startHour: number;
  endHour: number;
  days: number[];
  multiplier: number;
}

export interface PriceBreakdown {
  distanceMiles: number;
  baseRatePerMile: number;
  basePrice: number;
  isPeakTime: boolean;
  peakMultiplier: number;
  peakAdjustment: number;
  driverCompensation: number; // subtotal after peak - what driver gets
  subtotal: number; // alias for driverCompensation (compat with forms)
  platformFeePercent: number;
  platformFee: number;
  totalPrice: number; // driverCompensation + platformFee (but fee charged later)
}

export interface PricingSettings {
  baseRatePerMile: number;
  platformFeePercent: number;
  peakRules: PeakRule[];
}

export async function getPricingSettings(): Promise<PricingSettings> {
  const { data } = await supabase
    .from('pricing_settings')
    .select('*')
    .single();

  if (data) {
    return {
      baseRatePerMile: data.base_rate_per_mile || 2.5,
      platformFeePercent: data.platform_fee_percent || 0.15,
      peakRules: data.peak_rules || [
        { startHour: 6.5, endHour: 9, days: [1,2,3,4,5], multiplier: 1.35 },
        { startHour: 13.5, endHour: 16, days: [1,2,3,4,5], multiplier: 1.35 }
      ],
    };
  }

  // Fallback defaults
  return {
    baseRatePerMile: 2.5,
    platformFeePercent: 0.15,
    peakRules: [
      { startHour: 6.5, endHour: 9, days: [1,2,3,4,5], multiplier: 1.35 },
      { startHour: 13.5, endHour: 16, days: [1,2,3,4,5], multiplier: 1.35 }
    ],
  };
}

export function isPeakTime(date: Date = new Date(), rules: PeakRule[]): boolean {
  const day = date.getDay();
  const time = date.getHours() + date.getMinutes() / 60;

  return rules.some(rule => 
    rule.days.includes(day) &&
    time >= rule.startHour && 
    time <= rule.endHour
  );
}

export function getPeakMultiplier(date: Date = new Date(), rules: PeakRule[]): number {
  const day = date.getDay();
  const time = date.getHours() + date.getMinutes() / 60;

  const matchingRule = rules.find(rule => 
    rule.days.includes(day) &&
    time >= rule.startHour && 
    time <= rule.endHour
  );

  return matchingRule ? matchingRule.multiplier : 1;
}

export async function calculateTripPrice(
  distanceMiles: number,
  pickupTime: Date | string = new Date(),
  settings?: PricingSettings
): Promise<PriceBreakdown> {
  let s: PricingSettings;

  if (settings) {
    s = settings;
  } else {
    s = await getPricingSettings();
  }

  const date = typeof pickupTime === 'string' ? new Date(pickupTime) : pickupTime;

  const isPeak = isPeakTime(date, s.peakRules);
  const peakMultiplier = getPeakMultiplier(date, s.peakRules);

  const basePrice = distanceMiles * s.baseRatePerMile;
  const peakAdjustment = isPeak ? basePrice * (peakMultiplier - 1) : 0;
  const driverCompensation = basePrice + peakAdjustment;

  const platformFee = driverCompensation * s.platformFeePercent;
  const totalPrice = driverCompensation + platformFee;

  return {
    distanceMiles: Math.round(distanceMiles * 10) / 10,
    baseRatePerMile: s.baseRatePerMile,
    basePrice: Math.round(basePrice * 100) / 100,
    isPeakTime: isPeak,
    peakMultiplier,
    peakAdjustment: Math.round(peakAdjustment * 100) / 100,
    driverCompensation: Math.round(driverCompensation * 100) / 100,
    subtotal: Math.round(driverCompensation * 100) / 100,
    platformFeePercent: s.platformFeePercent,
    platformFee: Math.round(platformFee * 100) / 100,
    totalPrice: Math.round(totalPrice * 100) / 100,
  };
}

/** Stripe-ready payment amounts — keeps driver payout and platform fee clearly separated. */
export interface PaymentAmounts {
  driverCompensation: number;
  platformFee: number;
  totalPrice: number;
  driverCompensationCents: number;
  platformFeeCents: number;
  totalCents: number;
}

export function breakdownToPaymentAmounts(breakdown: PriceBreakdown): PaymentAmounts {
  return {
    driverCompensation: breakdown.driverCompensation,
    platformFee: breakdown.platformFee,
    totalPrice: breakdown.totalPrice,
    driverCompensationCents: Math.round(breakdown.driverCompensation * 100),
    platformFeeCents: Math.round(breakdown.platformFee * 100),
    totalCents: Math.round(breakdown.totalPrice * 100),
  };
}
