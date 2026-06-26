import type { SupabaseClient } from '@supabase/supabase-js';
import { getStripe } from '@/lib/stripe';

export type CompletedTripEarning = {
  id: string;
  title: string;
  pickup_location: string;
  dropoff_location: string;
  pickup_time: string;
  /** Last update timestamp — used for week grouping and date filters (no completed_at column). */
  updated_at: string;
  payout_amount: number;
  driver_payout_status: string;
  payment_status: string | null;
  platform_fee_status: string | null;
  organization_name: string;
  distance_miles: number | null;
};

export type ActiveTripEarning = {
  id: string;
  title: string;
  pickup_location: string;
  dropoff_location: string;
  pickup_time: string;
  status: string;
  expected_payout: number;
  organization_name: string;
  distance_miles: number | null;
};

export type WeeklyEarningsGroup = {
  week_key: string;
  week_start: string;
  week_end: string;
  label: string;
  trip_count: number;
  total_earnings: number;
  trips: CompletedTripEarning[];
};

export type DriverEarningsSummary = {
  total_trips: number;
  total_earnings: number;
};

export type DriverBalanceSummary = {
  current_balance: number;
  pending_payouts: number;
  paid_out_total: number;
  stripe_connected: boolean;
};

export type DriverEarningsResponse = {
  summary: DriverEarningsSummary;
  view: 'weekly' | 'filtered';
  weeks?: WeeklyEarningsGroup[];
  trips?: CompletedTripEarning[];
  has_more: boolean;
  page: number;
};

export type DriverPaymentsResponse = {
  balance: DriverBalanceSummary;
  completed: DriverEarningsResponse;
  active_trips: ActiveTripEarning[];
};

type TripRow = {
  id: string;
  title: string;
  pickup_location: string;
  dropoff_location: string;
  pickup_time: string;
  created_at: string;
  updated_at: string;
  status: string;
  final_price: number | null;
  total_price: number | null;
  price: number | null;
  driver_payout_status: string | null;
  payment_status: string | null;
  platform_fee_status: string | null;
  distance_miles: number | null;
  organization_id: string;
};

const TRIP_SELECT_FIELDS =
  'id, title, pickup_location, dropoff_location, pickup_time, created_at, updated_at, status, final_price, total_price, price, driver_payout_status, payment_status, platform_fee_status, distance_miles, organization_id';

const DEFAULT_WEEKS_PER_PAGE = 8;
const DEFAULT_TRIPS_PER_PAGE = 20;

/** Driver earnings: final_price (driver comp) → price (legacy) → total_price. */
export function getTripPayoutAmount(trip: {
  final_price?: number | null;
  price?: number | null;
  total_price?: number | null;
}): number {
  const amount = trip.final_price ?? trip.price ?? trip.total_price ?? 0;
  return Math.round(Number(amount) * 100) / 100;
}

export function isPendingDriverPayout(status: string | null | undefined): boolean {
  const normalized = status ?? 'pending';
  return normalized === 'pending' || normalized === 'failed';
}

export function isPaidDriverPayout(status: string | null | undefined): boolean {
  return status === 'transferred';
}

export function parseDateInputStart(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

export function parseDateInputEnd(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 23, 59, 59, 999);
}

/** Week starts on Sunday (US calendar convention). */
export function getWeekStart(date: Date): Date {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());
  return start;
}

export function getWeekEnd(weekStart: Date): Date {
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

export function formatWeekLabel(weekStart: Date, weekEnd: Date): string {
  const sameYear = weekStart.getFullYear() === weekEnd.getFullYear();
  const startLabel = weekStart.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
  const endLabel = weekEnd.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return `${startLabel} – ${endLabel}`;
}

export function formatCurrency(value: number): string {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  });
}

function toCompletedTripEarning(
  trip: TripRow,
  organizationName: string
): CompletedTripEarning {
  return {
    id: trip.id,
    title: trip.title,
    pickup_location: trip.pickup_location,
    dropoff_location: trip.dropoff_location,
    pickup_time: trip.pickup_time,
    updated_at: trip.updated_at,
    payout_amount: getTripPayoutAmount(trip),
    driver_payout_status: trip.driver_payout_status ?? 'pending',
    payment_status: trip.payment_status,
    platform_fee_status: trip.platform_fee_status,
    organization_name: organizationName,
    distance_miles: trip.distance_miles,
  };
}

function toActiveTripEarning(trip: TripRow, organizationName: string): ActiveTripEarning {
  return {
    id: trip.id,
    title: trip.title,
    pickup_location: trip.pickup_location,
    dropoff_location: trip.dropoff_location,
    pickup_time: trip.pickup_time,
    status: trip.status,
    expected_payout: getTripPayoutAmount(trip),
    organization_name: organizationName,
    distance_miles: trip.distance_miles,
  };
}

function isWithinDateRange(
  updatedAtIso: string,
  fromDate: Date | null,
  toDate: Date | null
): boolean {
  const updatedAt = new Date(updatedAtIso);
  if (fromDate && updatedAt < fromDate) return false;
  if (toDate && updatedAt > toDate) return false;
  return true;
}

export function groupTripsByWeek(trips: CompletedTripEarning[]): WeeklyEarningsGroup[] {
  const groups = new Map<string, WeeklyEarningsGroup>();

  for (const trip of trips) {
    const weekDate = new Date(trip.updated_at);
    const weekStart = getWeekStart(weekDate);
    const weekEnd = getWeekEnd(weekStart);
    const weekKey = weekStart.toISOString().slice(0, 10);

    const existing = groups.get(weekKey);
    if (existing) {
      existing.trips.push(trip);
      existing.trip_count += 1;
      existing.total_earnings =
        Math.round((existing.total_earnings + trip.payout_amount) * 100) / 100;
      continue;
    }

    groups.set(weekKey, {
      week_key: weekKey,
      week_start: weekStart.toISOString(),
      week_end: weekEnd.toISOString(),
      label: formatWeekLabel(weekStart, weekEnd),
      trip_count: 1,
      total_earnings: trip.payout_amount,
      trips: [trip],
    });
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      trips: [...group.trips].sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      ),
      total_earnings: Math.round(group.total_earnings * 100) / 100,
    }))
    .sort((a, b) => new Date(b.week_start).getTime() - new Date(a.week_start).getTime());
}

function summarizeTrips(trips: CompletedTripEarning[]): DriverEarningsSummary {
  const totalEarnings = trips.reduce((sum, trip) => sum + trip.payout_amount, 0);
  return {
    total_trips: trips.length,
    total_earnings: Math.round(totalEarnings * 100) / 100,
  };
}

function calculatePendingPayouts(completedTrips: CompletedTripEarning[]): number {
  const total = completedTrips
    .filter((trip) => isPendingDriverPayout(trip.driver_payout_status))
    .reduce((sum, trip) => sum + trip.payout_amount, 0);
  return Math.round(total * 100) / 100;
}

function calculatePaidOutTotal(completedTrips: CompletedTripEarning[]): number {
  const total = completedTrips
    .filter((trip) => isPaidDriverPayout(trip.driver_payout_status))
    .reduce((sum, trip) => sum + trip.payout_amount, 0);
  return Math.round(total * 100) / 100;
}

export async function fetchStripeConnectAvailableBalance(
  stripeAccountId: string | null | undefined
): Promise<number> {
  if (!stripeAccountId) return 0;

  try {
    const stripe = getStripe();
    const balance = await stripe.balance.retrieve({ stripeAccount: stripeAccountId });
    const availableUsd = (balance.available ?? [])
      .filter((entry) => entry.currency === 'usd')
      .reduce((sum, entry) => sum + entry.amount, 0);
    return Math.round(availableUsd) / 100;
  } catch (error) {
    console.error('Stripe Connect balance fetch failed:', error);
    return 0;
  }
}

async function loadOrganizationNames(
  supabase: SupabaseClient,
  orgIds: string[]
): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  if (orgIds.length === 0) return map;

  const { data, error } = await supabase
    .from('profiles')
    .select('id, organization_name, full_name')
    .in('id', orgIds);

  if (error) {
    console.error('Driver earnings org profile fetch error:', error);
    return map;
  }

  (data ?? []).forEach((profile) => {
    map[profile.id] = profile.organization_name || profile.full_name || 'Organization';
  });

  return map;
}

/** Completed trips for this driver — identified by status, not a completed_at column. */
async function fetchCompletedTripRows(
  supabase: SupabaseClient,
  driverId: string
): Promise<TripRow[]> {
  const { data, error } = await supabase
    .from('trips')
    .select(TRIP_SELECT_FIELDS)
    .eq('assigned_driver_id', driverId)
    .eq('status', 'completed')
    .order('updated_at', { ascending: false });

  if (error) {
    throw new Error(`Could not load completed trips: ${error.message}`);
  }

  return (data ?? []) as TripRow[];
}

/** Assigned trips that are not yet completed. */
async function fetchPendingTripRows(
  supabase: SupabaseClient,
  driverId: string
): Promise<TripRow[]> {
  const { data, error } = await supabase
    .from('trips')
    .select(TRIP_SELECT_FIELDS)
    .eq('assigned_driver_id', driverId)
    .neq('status', 'completed')
    .neq('status', 'cancelled')
    .order('pickup_time', { ascending: true });

  if (error) {
    throw new Error(`Could not load pending trips: ${error.message}`);
  }

  return (data ?? []) as TripRow[];
}

function buildCompletedEarningsResponse(
  completedTrips: CompletedTripEarning[],
  options: {
    from?: string | null;
    to?: string | null;
    page?: number;
    weeksPerPage?: number;
    tripsPerPage?: number;
  }
): DriverEarningsResponse {
  const page = Math.max(1, options.page ?? 1);
  const weeksPerPage = options.weeksPerPage ?? DEFAULT_WEEKS_PER_PAGE;
  const tripsPerPage = options.tripsPerPage ?? DEFAULT_TRIPS_PER_PAGE;
  const fromDate = options.from ? parseDateInputStart(options.from) : null;
  const toDate = options.to ? parseDateInputEnd(options.to) : null;
  const hasDateFilter = Boolean(fromDate || toDate);

  const scopedTrips = hasDateFilter
    ? completedTrips.filter((trip) =>
        isWithinDateRange(trip.updated_at, fromDate, toDate)
      )
    : completedTrips;

  const summary = summarizeTrips(scopedTrips);

  if (hasDateFilter) {
    const start = (page - 1) * tripsPerPage;
    const end = start + tripsPerPage;
    const pageTrips = scopedTrips.slice(start, end);

    return {
      summary,
      view: 'filtered',
      trips: pageTrips,
      has_more: end < scopedTrips.length,
      page,
    };
  }

  const weeks = groupTripsByWeek(scopedTrips);
  const visibleWeeks = weeks.slice(0, page * weeksPerPage);

  return {
    summary,
    view: 'weekly',
    weeks: visibleWeeks,
    has_more: visibleWeeks.length < weeks.length,
    page,
  };
}

export async function fetchDriverCompletedTripEarnings(
  supabase: SupabaseClient,
  driverId: string,
  options?: {
    from?: string | null;
    to?: string | null;
    page?: number;
    weeksPerPage?: number;
    tripsPerPage?: number;
  }
): Promise<DriverEarningsResponse> {
  const rows = await fetchCompletedTripRows(supabase, driverId);
  const orgIds = [...new Set(rows.map((trip) => trip.organization_id))];
  const orgNames = await loadOrganizationNames(supabase, orgIds);

  const completedTrips = rows
    .map((trip) => toCompletedTripEarning(trip, orgNames[trip.organization_id] ?? 'Organization'))
    .sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );

  return buildCompletedEarningsResponse(completedTrips, options ?? {});
}

export async function fetchDriverPaymentsDashboard(
  supabase: SupabaseClient,
  driverId: string,
  options?: {
    from?: string | null;
    to?: string | null;
    page?: number;
    stripeAccountId?: string | null;
    stripePayoutsEnabled?: boolean;
  }
): Promise<DriverPaymentsResponse> {
  const [completedRows, pendingRows] = await Promise.all([
    fetchCompletedTripRows(supabase, driverId),
    fetchPendingTripRows(supabase, driverId),
  ]);

  const orgIds = [
    ...new Set([
      ...completedRows.map((trip) => trip.organization_id),
      ...pendingRows.map((trip) => trip.organization_id),
    ]),
  ];
  const orgNames = await loadOrganizationNames(supabase, orgIds);

  const completedTrips = completedRows
    .map((trip) => toCompletedTripEarning(trip, orgNames[trip.organization_id] ?? 'Organization'))
    .sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );

  const activeTrips = pendingRows.map((trip) =>
    toActiveTripEarning(trip, orgNames[trip.organization_id] ?? 'Organization')
  );

  const stripeConnected = Boolean(options?.stripeAccountId && options?.stripePayoutsEnabled);
  const paidOutTotal = calculatePaidOutTotal(completedTrips);
  const currentBalance = stripeConnected
    ? await fetchStripeConnectAvailableBalance(options?.stripeAccountId)
    : paidOutTotal;

  return {
    balance: {
      current_balance: currentBalance,
      pending_payouts: calculatePendingPayouts(completedTrips),
      paid_out_total: paidOutTotal,
      stripe_connected: stripeConnected,
    },
    completed: buildCompletedEarningsResponse(completedTrips, options ?? {}),
    active_trips: activeTrips,
  };
}