'use client';

import { useEffect, useState } from 'react';
import {
  fetchDriverRatingStats,
  type DriverRatingStats,
} from '@/lib/rider/reviews';

// Phase 2: Review modal; recent snippets; half-star rendering

export interface DriverRatingSummaryProps {
  driverId: string;
  driverName?: string | null;
  /** Pre-loaded stats — skips client fetch when provided */
  stats?: DriverRatingStats | null;
  /** Section label above the rating row */
  showLabel?: boolean;
  /** `sm` for compact cards; `md` for trip detail */
  size?: 'sm' | 'md';
  /** Hide the component entirely while loading */
  hideWhileLoading?: boolean;
  className?: string;
}

function formatReviewCount(count: number): string {
  return count === 1 ? '1 review' : `${count.toLocaleString()} reviews`;
}

function StarRow({ rating, size }: { rating: number; size: 'sm' | 'md' }) {
  const filled = Math.max(0, Math.min(5, Math.round(rating)));
  const starClass = size === 'sm' ? 'text-base' : 'text-lg';

  return (
    <span className={`${starClass} leading-none`} aria-hidden>
      <span className="text-amber-400">{'★'.repeat(filled)}</span>
      <span className="text-blue-200">{'★'.repeat(5 - filled)}</span>
    </span>
  );
}

function LoadingPlaceholder({ size }: { size: 'sm' | 'md' }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-blue-100 ${size === 'sm' ? 'h-4 w-32' : 'h-5 w-40'}`}
      aria-label="Loading driver rating"
    />
  );
}

function NoReviewsState({ driverName, size }: { driverName?: string | null; size: 'sm' | 'md' }) {
  const textClass = size === 'sm' ? 'text-sm' : 'text-sm';
  return (
    <p className={`${textClass} text-blue-700`}>
      {driverName ? `${driverName} is ` : ''}
      new to Safe Ride Network — no ratings yet
    </p>
  );
}

export default function DriverRatingSummary({
  driverId,
  driverName,
  stats: prefetchedStats,
  showLabel = false,
  size = 'md',
  hideWhileLoading = false,
  className = '',
}: DriverRatingSummaryProps) {
  const [stats, setStats] = useState<DriverRatingStats | null>(prefetchedStats ?? null);
  const [loading, setLoading] = useState(prefetchedStats === undefined);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (prefetchedStats !== undefined) {
      setStats(prefetchedStats);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(false);

      try {
        const result = await fetchDriverRatingStats(driverId);
        if (!cancelled) {
          setStats(result);
        }
      } catch {
        if (!cancelled) {
          setError(true);
          setStats(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [driverId, prefetchedStats]);

  if (loading) {
    if (hideWhileLoading) return null;
    return (
      <div className={className}>
        {showLabel && (
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-blue-700">
            Driver rating
          </p>
        )}
        <LoadingPlaceholder size={size} />
      </div>
    );
  }

  if (error) {
    return (
      <div className={className}>
        {showLabel && (
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-blue-700">
            Driver rating
          </p>
        )}
        <p className="text-sm text-blue-600">Rating unavailable</p>
      </div>
    );
  }

  if (!stats || stats.reviewCount === 0) {
    return (
      <div className={className}>
        {showLabel && (
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-blue-700">
            Driver rating
          </p>
        )}
        <NoReviewsState driverName={driverName} size={size} />
      </div>
    );
  }

  const textClass = size === 'sm' ? 'text-sm' : 'text-sm';
  const scoreClass = size === 'sm' ? 'text-sm font-semibold' : 'text-base font-semibold';

  return (
    <div className={className}>
      {showLabel && (
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-blue-700">
          {driverName ? `${driverName}'s rating` : 'Driver rating'}
        </p>
      )}
      <div
        className="flex flex-wrap items-center gap-x-2 gap-y-1"
        aria-label={`${stats.avgRating} out of 5 stars, ${formatReviewCount(stats.reviewCount)}`}
      >
        <StarRow rating={stats.avgRating} size={size} />
        <span className={`${scoreClass} text-blue-950`}>{stats.avgRating.toFixed(1)}</span>
        <span className={`${textClass} text-blue-700`}>({formatReviewCount(stats.reviewCount)})</span>
      </div>
    </div>
  );
}