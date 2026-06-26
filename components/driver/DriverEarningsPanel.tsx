'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight } from 'lucide-react';
import EarningsDateRangeFilter from '@/components/driver/EarningsDateRangeFilter';
import { authFetch } from '@/lib/auth-fetch';
import {
  formatCurrency,
  type CompletedTripEarning,
  type DriverEarningsResponse,
  type WeeklyEarningsGroup,
} from '@/lib/driver/driver-earnings';
import { formatDateTime, routeSummary } from '@/lib/rider/format';
import { getErrorMessage } from '@/lib/errors';

function payoutStatusLabel(status: string): string {
  if (status === 'transferred') return 'Paid out';
  if (status === 'failed') return 'Payout failed';
  if (status === 'not_applicable') return 'N/A';
  return 'Pending payout';
}

function payoutStatusClass(status: string): string {
  if (status === 'transferred') return 'bg-green-50 text-green-700 border-green-200';
  if (status === 'failed') return 'bg-red-50 text-red-700 border-red-200';
  return 'bg-amber-50 text-amber-800 border-amber-200';
}

function SummaryCard({
  label,
  value,
  loading,
}: {
  label: string;
  value: string;
  loading?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-blue-950">
        {loading ? <span className="inline-block h-8 w-24 animate-pulse rounded bg-gray-100" /> : value}
      </p>
    </div>
  );
}

function TripEarningRow({ trip }: { trip: CompletedTripEarning }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-semibold text-blue-950">{trip.title}</h4>
            <span
              className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${payoutStatusClass(trip.driver_payout_status)}`}
            >
              {payoutStatusLabel(trip.driver_payout_status)}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-600">
            {routeSummary(trip.pickup_location, trip.dropoff_location)}
          </p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
            <span>Completed {formatDateTime(trip.completed_at)}</span>
            <span>{trip.organization_name}</span>
            {trip.distance_miles != null && <span>{trip.distance_miles} mi</span>}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
          <p className="text-lg font-bold text-green-700">{formatCurrency(trip.payout_amount)}</p>
          <Link
            href={`/dashboard/trip/${trip.id}`}
            className="text-xs font-medium text-[#1E3A8A] hover:underline"
          >
            View trip
          </Link>
        </div>
      </div>
    </div>
  );
}

function WeeklyEarningsSection({ week }: { week: WeeklyEarningsGroup }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition hover:bg-gray-50 sm:px-5"
      >
        <div className="flex min-w-0 items-center gap-3">
          {expanded ? (
            <ChevronDown size={18} className="shrink-0 text-gray-400" />
          ) : (
            <ChevronRight size={18} className="shrink-0 text-gray-400" />
          )}
          <div className="min-w-0">
            <p className="font-semibold text-blue-950">{week.label}</p>
            <p className="text-xs text-gray-500">
              {week.trip_count} trip{week.trip_count === 1 ? '' : 's'}
            </p>
          </div>
        </div>
        <p className="shrink-0 text-lg font-bold text-green-700">
          {formatCurrency(week.total_earnings)}
        </p>
      </button>

      {expanded && (
        <div className="space-y-3 border-t border-gray-100 px-4 py-4 sm:px-5">
          {week.trips.map((trip) => (
            <TripEarningRow key={trip.id} trip={trip} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function DriverEarningsPanel() {
  const [draftFromDate, setDraftFromDate] = useState('');
  const [draftToDate, setDraftToDate] = useState('');
  const [appliedFromDate, setAppliedFromDate] = useState('');
  const [appliedToDate, setAppliedToDate] = useState('');
  const [data, setData] = useState<DriverEarningsResponse | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isFiltered = Boolean(appliedFromDate || appliedToDate);

  const loadEarnings = useCallback(
    async (nextPage: number, append: boolean) => {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const params = new URLSearchParams({ page: String(nextPage) });
        if (appliedFromDate) params.set('from', appliedFromDate);
        if (appliedToDate) params.set('to', appliedToDate);

        const response = await authFetch(`/api/driver/earnings?${params.toString()}`);
        const payload = (await response.json()) as DriverEarningsResponse & { error?: string };

        if (!response.ok) {
          throw new Error(payload.error || 'Could not load earnings');
        }

        setData((prev) => {
          if (!append || !prev) return payload;

          if (payload.view === 'weekly' && prev.view === 'weekly') {
            const existingKeys = new Set((prev.weeks ?? []).map((week) => week.week_key));
            const mergedWeeks = [
              ...(prev.weeks ?? []),
              ...(payload.weeks ?? []).filter((week) => !existingKeys.has(week.week_key)),
            ];
            return { ...payload, weeks: mergedWeeks };
          }

          if (payload.view === 'filtered' && prev.view === 'filtered') {
            return {
              ...payload,
              trips: [...(prev.trips ?? []), ...(payload.trips ?? [])],
            };
          }

          return payload;
        });
        setPage(nextPage);
      } catch (err: unknown) {
        setError(getErrorMessage(err));
        if (!append) setData(null);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [appliedFromDate, appliedToDate]
  );

  useEffect(() => {
    void loadEarnings(1, false);
  }, [loadEarnings]);

  const handleApplyFilter = () => {
    setAppliedFromDate(draftFromDate);
    setAppliedToDate(draftToDate);
    setPage(1);
  };

  const handleClearFilter = () => {
    setDraftFromDate('');
    setDraftToDate('');
    setAppliedFromDate('');
    setAppliedToDate('');
    setPage(1);
  };

  const handleLoadMore = () => {
    void loadEarnings(page + 1, true);
  };

  const summary = data?.summary;
  const emptyState = !loading && data && summary?.total_trips === 0;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <SummaryCard
          label="Total Trips"
          value={String(summary?.total_trips ?? 0)}
          loading={loading}
        />
        <SummaryCard
          label="Total Earnings"
          value={formatCurrency(summary?.total_earnings ?? 0)}
          loading={loading}
        />
      </div>

      <EarningsDateRangeFilter
        fromDate={draftFromDate}
        toDate={draftToDate}
        onFromDateChange={setDraftFromDate}
        onToDateChange={setDraftToDate}
        onApply={handleApplyFilter}
        onClear={handleClearFilter}
        isFiltered={isFiltered}
        loading={loading}
      />

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading && !data ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white py-16">
          <div className="mb-3 h-8 w-8 animate-spin rounded-full border-2 border-[#1E3A8A] border-t-transparent" />
          <p className="text-sm text-blue-950">Loading earnings...</p>
        </div>
      ) : emptyState ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-14 text-center">
          <h3 className="text-lg font-semibold text-blue-950">No completed trips yet</h3>
          <p className="mt-2 text-sm text-gray-600">
            {isFiltered
              ? 'No completed trips were found in the selected date range.'
              : 'Completed trip earnings will appear here once you finish assigned trips.'}
          </p>
          <Link
            href="/dashboard/trips"
            className="mt-5 inline-flex rounded-xl bg-[#1E3A8A] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-900"
          >
            Browse Trips
          </Link>
        </div>
      ) : data?.view === 'filtered' ? (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Trips in selected range
          </h3>
          {(data.trips ?? []).map((trip) => (
            <TripEarningRow key={trip.id} trip={trip} />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Weekly summary
          </h3>
          {(data?.weeks ?? []).map((week) => (
            <WeeklyEarningsSection key={week.week_key} week={week} />
          ))}
        </div>
      )}

      {data?.has_more && (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-blue-950 transition hover:bg-gray-50 disabled:opacity-60"
          >
            {loadingMore
              ? 'Loading...'
              : data.view === 'weekly'
                ? 'Load more weeks'
                : 'Load more trips'}
          </button>
        </div>
      )}
    </div>
  );
}