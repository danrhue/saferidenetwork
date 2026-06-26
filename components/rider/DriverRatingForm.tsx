'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  submitRiderDriverReview,
  type RiderDriverReview,
} from '@/lib/rider/reviews';
import DriverRatingSummary from '@/components/rider/DriverRatingSummary';

// Phase 2: Review moderation; photo uploads; expanded feedback tags

const STAR_LABELS: Record<number, string> = {
  1: 'Poor',
  2: 'Fair',
  3: 'Good',
  4: 'Great',
  5: 'Excellent',
};

export interface DriverRatingFormProps {
  tripId: string;
  driverId: string;
  driverName?: string | null;
  /** When set, renders read-only submitted review instead of the form. */
  existingReview?: RiderDriverReview | null;
  onSubmitted?: (review: RiderDriverReview) => void;
  className?: string;
}

function formatReviewDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function StarDisplay({ rating, size = 'md' }: { rating: number; size?: 'md' | 'lg' }) {
  const starClass = size === 'lg' ? 'text-2xl' : 'text-lg';
  return (
    <span className={`${starClass} leading-none text-amber-400`} aria-hidden>
      {'★'.repeat(rating)}
      <span className="text-blue-200">{'★'.repeat(5 - rating)}</span>
    </span>
  );
}

function SubmittedReview({
  review,
  driverName,
}: {
  review: RiderDriverReview;
  driverName?: string | null;
}) {
  return (
    <div className="rounded-2xl border border-green-200 bg-green-50 p-6 shadow-sm">
      <div className="flex items-start gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-600 text-white"
          aria-hidden
        >
          ✓
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-green-950">Thanks for your feedback</h2>
          <p className="mt-1 text-sm text-green-900">
            You rated {driverName ?? 'your driver'} on {formatReviewDate(review.created_at)}.
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-green-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <StarDisplay rating={review.rating} size="lg" />
          <span className="text-sm font-medium text-blue-950">
            {STAR_LABELS[review.rating] ?? `${review.rating} stars`}
          </span>
        </div>
        {review.comment && (
          <p className="mt-3 whitespace-pre-wrap text-sm italic text-blue-800">
            &ldquo;{review.comment}&rdquo;
          </p>
        )}
      </div>
    </div>
  );
}

export default function DriverRatingForm({
  tripId,
  driverId,
  driverName,
  existingReview = null,
  onSubmitted,
  className = '',
}: DriverRatingFormProps) {
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submittedReview, setSubmittedReview] = useState<RiderDriverReview | null>(null);

  const displayReview = submittedReview ?? existingReview;

  if (displayReview) {
    return (
      <div className={className}>
        <SubmittedReview review={displayReview} driverName={driverName} />
      </div>
    );
  }

  const activeStars = hoverRating || rating;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('Please sign in to submit a review.');
      }

      const review = await submitRiderDriverReview({
        tripId,
        riderId: user.id,
        driverId,
        rating,
        comment,
      });

      setSubmittedReview(review);
      onSubmitted?.(review);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={`rounded-2xl border border-blue-200 bg-white p-6 shadow-sm ${className}`.trim()}
    >
      <h2 className="text-lg font-semibold text-blue-950">
        How was your trip with {driverName ?? 'your driver'}?
      </h2>
      <DriverRatingSummary
        driverId={driverId}
        driverName={driverName}
        size="sm"
        className="mt-2"
      />
      <p className="mt-3 text-sm text-blue-800">
        Your rating helps other riders and recognizes great drivers.
      </p>

      <div className="mt-5">
        <p className="text-sm font-medium text-blue-900">Your rating</p>
        <div
          className="mt-2 flex items-center gap-1"
          role="radiogroup"
          aria-label="Star rating"
        >
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={rating === value}
              aria-label={`${value} star${value === 1 ? '' : 's'} — ${STAR_LABELS[value]}`}
              onClick={() => setRating(value)}
              onMouseEnter={() => setHoverRating(value)}
              onMouseLeave={() => setHoverRating(0)}
              onFocus={() => setHoverRating(value)}
              onBlur={() => setHoverRating(0)}
              className={`rounded-lg px-1 py-0.5 text-3xl leading-none transition sm:text-4xl ${
                value <= activeStars ? 'text-amber-400' : 'text-blue-200'
              } hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A8A]`}
            >
              ★
            </button>
          ))}
        </div>
        <p className="mt-1 text-sm text-blue-700">{STAR_LABELS[rating]}</p>
      </div>

      <div className="mt-5">
        <label htmlFor="driver-review-comment" className="text-sm font-medium text-blue-900">
          Comments <span className="font-normal text-blue-600">(optional)</span>
        </label>
        <textarea
          id="driver-review-comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={4}
          maxLength={1000}
          placeholder="Share what went well or what could be improved..."
          className="mt-2 w-full resize-y rounded-xl border border-blue-200 px-4 py-3 text-sm text-blue-950 placeholder:text-blue-400 focus:border-[#1E3A8A] focus:outline-none focus:ring-2 focus:ring-blue-100"
        />
        <p className="mt-1 text-right text-xs text-blue-500">{comment.length}/1000</p>
      </div>

      {error && (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-[#1E3A8A] px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
      >
        {submitting ? 'Submitting...' : 'Submit rating'}
      </button>
    </form>
  );
}