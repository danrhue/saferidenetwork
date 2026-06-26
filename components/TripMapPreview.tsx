'use client';

import { useEffect, useMemo, useState } from 'react';
import { buildTripStaticMapUrl } from '@/lib/google-static-map';

interface TripMapPreviewProps {
  pickup: string;
  dropoff: string;
  className?: string;
  alt?: string;
}

export default function TripMapPreview({
  pickup,
  dropoff,
  className = 'h-64 w-full object-cover',
  alt = 'Trip route map',
}: TripMapPreviewProps) {
  const [mapUrl, setMapUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const fallbackUrl = useMemo(
    () => buildTripStaticMapUrl(pickup, dropoff, { width: 640, height: 300, scale: 2 }),
    [pickup, dropoff]
  );

  useEffect(() => {
    let cancelled = false;

    const loadPreview = async () => {
      setLoading(true);
      setFailed(false);
      setMapUrl(null);

      try {
        const params = new URLSearchParams({ pickup, dropoff });
        const res = await fetch(`/api/maps/trip-preview?${params.toString()}`);
        const data = await res.json();

        if (cancelled) return;

        if (res.ok && typeof data.imageUrl === 'string') {
          setMapUrl(data.imageUrl);
        } else if (fallbackUrl) {
          setMapUrl(fallbackUrl);
        } else {
          setFailed(true);
        }
      } catch {
        if (!cancelled) {
          if (fallbackUrl) {
            setMapUrl(fallbackUrl);
          } else {
            setFailed(true);
          }
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadPreview();

    return () => {
      cancelled = true;
    };
  }, [pickup, dropoff, fallbackUrl]);

  if (loading) {
    return (
      <div className="h-64 w-full bg-gradient-to-br from-blue-50 to-indigo-100 animate-pulse flex items-center justify-center">
        <span className="text-xs font-medium text-blue-800/70">Loading route map…</span>
      </div>
    );
  }

  if (!mapUrl || failed) {
    return (
      <div className="h-64 w-full bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center px-6 text-center">
        <div className="text-sm text-blue-900">
          <div className="font-semibold mb-1">Route preview unavailable</div>
          <div className="text-xs text-blue-800 line-clamp-2">
            {pickup} → {dropoff}
          </div>
        </div>
      </div>
    );
  }

  return (
    <img
      src={mapUrl}
      alt={alt}
      className={className}
      loading="lazy"
      onError={() => {
        if (fallbackUrl && mapUrl !== fallbackUrl) {
          setMapUrl(fallbackUrl);
        } else {
          setFailed(true);
        }
      }}
    />
  );
}