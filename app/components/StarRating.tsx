'use client';

import { useState } from 'react';

interface StarRatingProps {
  rating: number; // 1-5 or 0-5 with decimals
  onRate?: (rating: number) => void;
  interactive?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export default function StarRating({ rating, onRate, interactive = false, size = 'md' }: StarRatingProps) {
  const [hoverRating, setHoverRating] = useState(0);

  const sizeClasses = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-3xl',
  };

  const displayRating = hoverRating || rating;

  const handleClick = (star: number) => {
    if (interactive && onRate) {
      onRate(star);
    }
  };

  return (
    <div className={`flex items-center gap-0.5 ${sizeClasses[size]}`}>
      {[1, 2, 3, 4, 5].map((star) => {
        const isFilled = star <= Math.floor(displayRating);
        const isHalf = !isFilled && star - 0.5 <= displayRating;

        return (
          <span
            key={star}
            className={`cursor-${interactive ? 'pointer' : 'default'} transition-colors ${
              isFilled || isHalf ? 'text-yellow-400' : 'text-gray-300'
            } ${interactive ? 'hover:text-yellow-400' : ''}`}
            onClick={() => handleClick(star)}
            onMouseEnter={() => interactive && setHoverRating(star)}
            onMouseLeave={() => interactive && setHoverRating(0)}
          >
            {isFilled ? '★' : isHalf ? '☆' : '☆'}
          </span>
        );
      })}
      {!interactive && rating > 0 && (
        <span className="ml-2 text-sm text-gray-600 font-medium">({rating.toFixed(1)})</span>
      )}
    </div>
  );
}
