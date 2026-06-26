import { NextRequest, NextResponse } from 'next/server';
import {
  buildTripStaticMapUrlFromCoords,
  DEFAULT_TRIP_MAP_SIZE,
  type LatLng,
  type RouteBounds,
} from '@/lib/google-static-map';

export const dynamic = 'force-dynamic';

const GEOCODE_PARAMS = '&region=US&components=country:US';

async function geocodeAddress(
  address: string,
  apiKey: string
): Promise<LatLng | null> {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}${GEOCODE_PARAMS}`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  const data = await res.json();

  if (data.status !== 'OK' || !data.results?.[0]?.geometry?.location) {
    return null;
  }

  const { lat, lng } = data.results[0].geometry.location;
  return { lat, lng };
}

async function fetchDrivingRoute(
  pickup: LatLng,
  dropoff: LatLng,
  apiKey: string
): Promise<{ encodedPolyline: string | null; routeBounds?: RouteBounds }> {
  const origin = `${pickup.lat},${pickup.lng}`;
  const destination = `${dropoff.lat},${dropoff.lng}`;
  const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&mode=driving&key=${apiKey}`;

  const res = await fetch(url, { next: { revalidate: 3600 } });
  const data = await res.json();

  if (data.status !== 'OK' || !data.routes?.[0]) {
    return { encodedPolyline: null };
  }

  const route = data.routes[0];
  const encodedPolyline = route.overview_polyline?.points ?? null;
  const bounds = route.bounds;

  const routeBounds: RouteBounds | undefined =
    bounds?.southwest && bounds?.northeast
      ? {
          southwest: {
            lat: bounds.southwest.lat,
            lng: bounds.southwest.lng,
          },
          northeast: {
            lat: bounds.northeast.lat,
            lng: bounds.northeast.lng,
          },
        }
      : undefined;

  return { encodedPolyline, routeBounds };
}

/**
 * GET /api/maps/trip-preview?pickup=...&dropoff=...
 * Returns a Google Static Maps image URL with driving route (or straight-line fallback).
 */
export async function GET(request: NextRequest) {
  const pickup = request.nextUrl.searchParams.get('pickup')?.trim();
  const dropoff = request.nextUrl.searchParams.get('dropoff')?.trim();

  if (!pickup || !dropoff) {
    return NextResponse.json(
      { error: 'Pickup and dropoff are required.' },
      { status: 400 }
    );
  }

  const apiKey =
    process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Google Maps API key is missing.' },
      { status: 500 }
    );
  }

  try {
    const [pickupCoords, dropoffCoords] = await Promise.all([
      geocodeAddress(pickup, apiKey),
      geocodeAddress(dropoff, apiKey),
    ]);

    if (!pickupCoords || !dropoffCoords) {
      return NextResponse.json(
        { error: 'Could not resolve one or both locations.' },
        { status: 400 }
      );
    }

    const { encodedPolyline, routeBounds } = await fetchDrivingRoute(
      pickupCoords,
      dropoffCoords,
      apiKey
    );

    const imageUrl = buildTripStaticMapUrlFromCoords(pickupCoords, dropoffCoords, apiKey, {
      width: DEFAULT_TRIP_MAP_SIZE.width,
      height: DEFAULT_TRIP_MAP_SIZE.height,
      scale: DEFAULT_TRIP_MAP_SIZE.scale,
      encodedPolyline: encodedPolyline ?? undefined,
      routeBounds,
    });

    return NextResponse.json({
      imageUrl,
      hasDrivingRoute: !!encodedPolyline,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('trip-preview error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}