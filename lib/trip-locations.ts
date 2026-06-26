export type TripLocationRow = {
  lat?: number | string | null;
  lng?: number | string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  recorded_at?: string | null;
  speed?: number | string | null;
  accuracy?: number | string | null;
};

export type NormalizedTripLocation = {
  lat: number;
  lng: number;
  recorded_at: string | null;
  speed: number | null;
  accuracy: number | null;
};

/** Normalize trip_locations rows whether the DB uses lat/lng or latitude/longitude. */
export function normalizeTripLocation(row: TripLocationRow): NormalizedTripLocation | null {
  const lat = Number(row.latitude ?? row.lat);
  const lng = Number(row.longitude ?? row.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return {
    lat,
    lng,
    recorded_at: row.recorded_at ?? null,
    speed: row.speed != null && Number.isFinite(Number(row.speed)) ? Number(row.speed) : null,
    accuracy:
      row.accuracy != null && Number.isFinite(Number(row.accuracy)) ? Number(row.accuracy) : null,
  };
}

export const TRIP_LOCATION_SELECT_MODERN =
  'latitude, longitude, recorded_at, speed, accuracy';

export const TRIP_LOCATION_SELECT_LEGACY = 'lat, lng, recorded_at';

type TripLocationInsertClient = {
  from: (table: string) => {
    insert: (
      values: Record<string, unknown>
    ) => PromiseLike<{ error: { message?: string } | null }>;
  };
};

export async function insertTripLocationPoint(
  supabase: TripLocationInsertClient,
  payload: {
    trip_id: string;
    lat: number;
    lng: number;
    speed?: number | null;
    accuracy?: number | null;
  }
): Promise<{ error: { message?: string } | null }> {
  const modern = await Promise.resolve(
    supabase.from('trip_locations').insert({
      trip_id: payload.trip_id,
      latitude: payload.lat,
      longitude: payload.lng,
      speed: payload.speed ?? null,
      accuracy: payload.accuracy ?? null,
    })
  );

  if (!modern.error) return modern;

  if (!isMissingTripLocationColumnError(modern.error.message)) {
    return modern;
  }

  return Promise.resolve(
    supabase.from('trip_locations').insert({
      trip_id: payload.trip_id,
      lat: payload.lat,
      lng: payload.lng,
    })
  );
}

export function isMissingTripLocationColumnError(message?: string | null): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  return (
    lower.includes('latitude') ||
    lower.includes('longitude') ||
    lower.includes('speed') ||
    lower.includes('accuracy') ||
    lower.includes('column') && (lower.includes('lat') || lower.includes('lng'))
  );
}