import type { SupabaseClient } from '@supabase/supabase-js';

export type CompletedTripEarning = {
  id: string;
  title: string;
  pickup_location: string;
  dropoff_location: string;
  pickup_time: string;
  completed_at: string;
  payout_amount: number;
  driver_payout_status: string;
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

export type DriverEarningsResponse = {
  summary: DriverEarningsSummary;
  view: 'weekly' | 'filtered';
  weeks?: WeeklyEarningsGroup[];
  trips?: CompletedTripEarning[];
  has_more: boolean;
  page: number;
};

type TripRow = {
  id: string;
  title: string;
  pickup_location: string;
  dropoff_location: string;
  pickup_time: string;
  ended_at: string | null;
  updated_at: string;
  final_price: number | null;
  price: number | null;
  driver_payout_status: string | null;
  distance_miles: number | null;
  organization_id: string;
};

const DEFAULT_WEEKS_PER_PAGE = 8;
const DEFAULT_TRIPS_PER_PAGE = 20;

export function getTripPayoutAmount(trip: {
  final_price?: number | null;
  price?: number | null;
}): number {
  const amount = trip.final_price ?? trip.price ?? 0;
  return Math.round(Number(amount) * 100) / 100;
}

export function getTripCompletedAt(trip: {
  ended_at?: string | null;
  updated_at?: string | null;
}): string {
  return trip.ended_at ?? trip.updated_at ?? new Date(0).toISOString();
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
    completed_at: getTripCompletedAt(trip),
    payout_amount: getTripPayoutAmount(trip),
    driver_payout_status: trip.driver_payout_status ?? 'pending',
    organization_name: organizationName,
    distance_miles: trip.distance_miles,
  };
}

function isWithinDateRange(
  completedAtIso: string,
  fromDate: Date | null,
  toDate: Date | null
): boolean {
  const completedAt = new Date(completedAtIso);
  if (fromDate && completedAt < fromDate) return false;
  if (toDate && completedAt > toDate) return false;
  return true;
}

export function groupTripsByWeek(trips: CompletedTripEarning[]): WeeklyEarningsGroup[] {
  const groups = new Map<string, WeeklyEarningsGroup>();

  for (const trip of trips) {
    const completedDate = new Date(trip.completed_at);
    const weekStart = getWeekStart(completedDate);
    const weekEnd = getWeekEnd(weekStart);
    const weekKey = weekStart.toISOString().slice(0, 10);

    const existing = groups.get(weekKey);
    if (existing) {
      existing.trips.push(trip);
      existing.trip_count += 1;
      existing.total_earnings = Math.round((existing.total_earnings + trip.payout_amount) * 100) / 100;
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
        (a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime()
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
  const page = Math.max(1, options?.page ?? 1);
  const weeksPerPage = options?.weeksPerPage ?? DEFAULT_WEEKS_PER_PAGE;
  const tripsPerPage = options?.tripsPerPage ?? DEFAULT_TRIPS_PER_PAGE;
  const fromDate = options?.from ? parseDateInputStart(options.from) : null;
  const toDate = options?.to ? parseDateInputEnd(options.to) : null;
  const hasDateFilter = Boolean(fromDate || toDate);

  const { data, error } = await supabase
    .from('trips')
    .select(
      'id, title, pickup_location, dropoff_location, pickup_time, ended_at, updated_at, final_price, price, driver_payout_status, distance_miles, organization_id'
    )
    .eq('assigned_driver_id', driverId)
    .eq('status', 'completed')
    .order('updated_at', { ascending: false });

  if (error) {
    throw new Error(`Could not load completed trips: ${error.message}`);
  }

  const rows = (data ?? []) as TripRow[];
  const orgIds = [...new Set(rows.map((trip) => trip.organization_id))];
  const orgNames = await loadOrganizationNames(supabase, orgIds);

  const allTrips = rows
    .map((trip) =>
      toCompletedTripEarning(trip, orgNames[trip.organization_id] ?? 'Organization')
    )
    .sort(
      (a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime()
    );

  const scopedTrips = hasDateFilter
    ? allTrips.filter((trip) => isWithinDateRange(trip.completed_at, fromDate, toDate))
    : allTrips;

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