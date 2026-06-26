/**
 * Rider driver reviews — fetch/submit ratings and public driver aggregates.
 */

import { supabase } from '@/lib/supabase';

/** Aggregated public rating for a driver (from driver_rating_stats). */
export type DriverRatingStats = {
  driverId: string;
  avgRating: number;
  reviewCount: number;
};

type DriverRatingStatsRow = {
  driver_id: string;
  avg_rating: number | string;
  review_count: number | string;
};

function mapDriverRatingStatsRow(row: DriverRatingStatsRow): DriverRatingStats {
  return {
    driverId: row.driver_id,
    avgRating: Number(row.avg_rating),
    reviewCount: Number(row.review_count),
  };
}

/**
 * Fetch a driver's public average rating and review count.
 * Uses get_driver_rating_stats RPC (full aggregates) with view fallback.
 */
export async function fetchDriverRatingStats(
  driverId: string
): Promise<DriverRatingStats | null> {
  const { data: rpcData, error: rpcError } = await supabase
    .rpc('get_driver_rating_stats', { p_driver_id: driverId })
    .maybeSingle();

  if (!rpcError && rpcData) {
    return mapDriverRatingStatsRow(rpcData as DriverRatingStatsRow);
  }

  // Fallback when RPC is not deployed — may be RLS-limited for riders
  const { data, error } = await supabase
    .from('driver_rating_stats')
    .select('driver_id, avg_rating, review_count')
    .eq('driver_id', driverId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const stats = mapDriverRatingStatsRow(data as DriverRatingStatsRow);
  return stats.reviewCount > 0 ? stats : null;
}

/** Rider-authored driver review (maps DB `review` column to `comment`). */
export type RiderDriverReview = {
  id: string;
  trip_id: string;
  rider_id: string;
  driver_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
};

type DriverReviewRow = {
  id: string;
  trip_id: string;
  rider_id: string | null;
  driver_id: string;
  rating: number;
  review: string | null;
  created_at: string;
};

export function mapDriverReviewRow(row: DriverReviewRow): RiderDriverReview {
  return {
    id: row.id,
    trip_id: row.trip_id,
    rider_id: row.rider_id!,
    driver_id: row.driver_id,
    rating: row.rating,
    comment: row.review,
    created_at: row.created_at,
  };
}

/** Load the rider's review for a trip, if any. */
export async function fetchRiderReviewForTrip(
  tripId: string,
  riderId: string
): Promise<RiderDriverReview | null> {
  const { data, error } = await supabase
    .from('driver_reviews')
    .select('id, trip_id, rider_id, driver_id, rating, review, created_at')
    .eq('trip_id', tripId)
    .eq('rider_id', riderId)
    .maybeSingle();

  if (error || !data || !data.rider_id) {
    return null;
  }

  return mapDriverReviewRow(data as DriverReviewRow);
}

export type SubmitRiderDriverReviewInput = {
  tripId: string;
  riderId: string;
  driverId: string;
  rating: number;
  comment?: string;
};

/** Insert a rider review for a completed trip. */
export async function submitRiderDriverReview(
  input: SubmitRiderDriverReviewInput
): Promise<RiderDriverReview> {
  const { tripId, riderId, driverId, rating, comment } = input;

  const { data, error } = await supabase
    .from('driver_reviews')
    .insert({
      trip_id: tripId,
      rider_id: riderId,
      driver_id: driverId,
      organization_id: null,
      rating,
      review: comment?.trim() || null,
    })
    .select('id, trip_id, rider_id, driver_id, rating, review, created_at')
    .single();

  if (error || !data || !data.rider_id) {
    throw new Error(error?.message ?? 'Failed to submit review');
  }

  return mapDriverReviewRow(data as DriverReviewRow);
}