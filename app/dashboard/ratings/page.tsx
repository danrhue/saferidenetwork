'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface Review {
  id: string;
  rating: number;
  review: string | null;
  created_at: string;
  organization_name?: string;
}

export default function DriverRatingsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [avgRating, setAvgRating] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: revs } = await supabase
        .from('driver_reviews')
        .select(`
          *,
          profiles:organization_id (organization_name, full_name)
        `)
        .eq('driver_id', user.id)
        .order('created_at', { ascending: false });

      if (revs) {
        const formatted = revs.map((r: Review & { profiles?: { organization_name?: string; full_name?: string } }) => ({
          ...r,
          organization_name:
            r.profiles?.organization_name || r.profiles?.full_name || 'Organization',
        }));
        setReviews(formatted);

        if (formatted.length > 0) {
          const avg = formatted.reduce((sum, r) => sum + r.rating, 0) / formatted.length;
          setAvgRating(Math.round(avg * 10) / 10);
        }
      }

      setLoading(false);
    };

    load();
  }, []);

  if (loading) {
    return <div className="p-8 text-center text-blue-800">Loading ratings...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Your Ratings</h1>
      <p className="text-gray-600 mb-8">Feedback from organizations and riders</p>

      {reviews.length > 0 ? (
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-2xl p-8 flex items-center gap-4">
            <span className="text-5xl font-bold text-yellow-500">★ {avgRating}</span>
            <div>
              <p className="text-lg font-semibold text-blue-950">Average rating</p>
              <p className="text-gray-600">
                {reviews.length} review{reviews.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {reviews.map((review) => (
              <div key={review.id} className="bg-white border border-gray-200 rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-yellow-500 text-lg">
                    {'★'.repeat(review.rating)}
                    {'☆'.repeat(5 - review.rating)}
                  </span>
                  <span className="text-sm text-gray-600">by {review.organization_name}</span>
                </div>
                {review.review && (
                  <p className="text-sm text-gray-700 italic">&ldquo;{review.review}&rdquo;</p>
                )}
                <p className="text-xs text-gray-500 mt-3">
                  {new Date(review.created_at).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
          <div className="text-6xl mb-6">⭐</div>
          <h3 className="text-2xl font-semibold text-blue-950 mb-3">No ratings yet</h3>
          <p className="text-gray-600 max-w-md mx-auto">
            Complete some trips to start receiving feedback from organizations and riders.
          </p>
        </div>
      )}
    </div>
  );
}