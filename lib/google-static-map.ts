export interface StaticMapOptions {
  width?: number;
  height?: number;
  scale?: 1 | 2;
}

export interface LatLng {
  lat: number;
  lng: number;
}

export interface RouteBounds {
  southwest: LatLng;
  northeast: LatLng;
}

/** Google Static Maps max dimension per side. */
export const STATIC_MAP_MAX_DIMENSION = 640;

export const DEFAULT_TRIP_MAP_SIZE = {
  width: 640,
  height: 300,
  scale: 2 as const,
};

const BRAND_ROUTE_COLOR = '0x1E3A8A';
const ROUTE_WEIGHT = 7;

/** Decode a Google encoded polyline into lat/lng points. */
export function decodeGooglePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const deltaLat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += deltaLat;

    shift = 0;
    result = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const deltaLng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += deltaLng;

    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }

  return points;
}

function appendMarker(
  params: URLSearchParams,
  color: string,
  label: string,
  location: string
) {
  params.append('markers', `color:${color}|label:${label}|${location}`);
}

function appendRoutePath(
  params: URLSearchParams,
  pickup: LatLng,
  dropoff: LatLng,
  encodedPolyline?: string
) {
  if (encodedPolyline) {
    params.append('path', `color:${BRAND_ROUTE_COLOR}|weight:${ROUTE_WEIGHT}|enc:${encodedPolyline}`);
    return;
  }

  params.append(
    'path',
    `color:${BRAND_ROUTE_COLOR}|weight:${ROUTE_WEIGHT}|${pickup.lat},${pickup.lng}|${dropoff.lat},${dropoff.lng}`
  );
}

function padBounds(
  southwest: LatLng,
  northeast: LatLng,
  paddingRatio: number
): [LatLng, LatLng] {
  const latSpan = Math.max(northeast.lat - southwest.lat, 0.012);
  const lngSpan = Math.max(northeast.lng - southwest.lng, 0.012);
  const latPad = latSpan * paddingRatio;
  const lngPad = lngSpan * paddingRatio;

  return [
    { lat: southwest.lat - latPad, lng: southwest.lng - lngPad },
    { lat: northeast.lat + latPad, lng: northeast.lng + lngPad },
  ];
}

/** Pad the bounding box so the map is zoomed out with context around the route. */
export function paddedVisibleCorners(
  pickup: LatLng,
  dropoff: LatLng,
  paddingRatio = 0.45
): [LatLng, LatLng] {
  const minLat = Math.min(pickup.lat, dropoff.lat);
  const maxLat = Math.max(pickup.lat, dropoff.lat);
  const minLng = Math.min(pickup.lng, dropoff.lng);
  const maxLng = Math.max(pickup.lng, dropoff.lng);

  return padBounds(
    { lat: minLat, lng: minLng },
    { lat: maxLat, lng: maxLng },
    paddingRatio
  );
}

export function paddedVisibleCornersFromPoints(
  points: LatLng[],
  paddingRatio = 0.36
): [LatLng, LatLng] {
  let minLat = points[0].lat;
  let maxLat = points[0].lat;
  let minLng = points[0].lng;
  let maxLng = points[0].lng;

  for (const point of points) {
    minLat = Math.min(minLat, point.lat);
    maxLat = Math.max(maxLat, point.lat);
    minLng = Math.min(minLng, point.lng);
    maxLng = Math.max(maxLng, point.lng);
  }

  return padBounds({ lat: minLat, lng: minLng }, { lat: maxLat, lng: maxLng }, paddingRatio);
}

function resolveVisibleCorners(
  pickup: LatLng,
  dropoff: LatLng,
  encodedPolyline?: string,
  routeBounds?: RouteBounds
): [LatLng, LatLng] {
  if (routeBounds) {
    return padBounds(routeBounds.southwest, routeBounds.northeast, 0.34);
  }

  if (encodedPolyline) {
    const pathPoints = decodeGooglePolyline(encodedPolyline);
    if (pathPoints.length > 1) {
      return paddedVisibleCornersFromPoints(pathPoints, 0.36);
    }
  }

  return paddedVisibleCorners(pickup, dropoff, 0.45);
}

/** Build a static map URL from coordinates with route line and a wider framed viewport. */
export function buildTripStaticMapUrlFromCoords(
  pickup: LatLng,
  dropoff: LatLng,
  apiKey: string,
  options: StaticMapOptions & {
    encodedPolyline?: string;
    routeBounds?: RouteBounds;
  } = {}
): string {
  const width = Math.min(options.width ?? DEFAULT_TRIP_MAP_SIZE.width, STATIC_MAP_MAX_DIMENSION);
  const height = Math.min(options.height ?? DEFAULT_TRIP_MAP_SIZE.height, STATIC_MAP_MAX_DIMENSION);
  const scale = options.scale ?? DEFAULT_TRIP_MAP_SIZE.scale;

  const params = new URLSearchParams({
    size: `${width}x${height}`,
    scale: String(scale),
    maptype: 'roadmap',
    key: apiKey,
  });

  appendMarker(params, 'blue', 'A', `${pickup.lat},${pickup.lng}`);
  appendMarker(params, 'red', 'B', `${dropoff.lat},${dropoff.lng}`);
  appendRoutePath(params, pickup, dropoff, options.encodedPolyline);

  const [southWest, northEast] = resolveVisibleCorners(
    pickup,
    dropoff,
    options.encodedPolyline,
    options.routeBounds
  );
  params.append(
    'visible',
    `${southWest.lat},${southWest.lng}|${northEast.lat},${northEast.lng}`
  );

  return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
}

/** Address-based fallback when coordinates are unavailable (client-side). */
export function buildTripStaticMapUrl(
  pickup: string,
  dropoff: string,
  options: StaticMapOptions = {}
): string | null {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey || !pickup?.trim() || !dropoff?.trim()) {
    return null;
  }

  const width = Math.min(options.width ?? DEFAULT_TRIP_MAP_SIZE.width, STATIC_MAP_MAX_DIMENSION);
  const height = Math.min(options.height ?? DEFAULT_TRIP_MAP_SIZE.height, STATIC_MAP_MAX_DIMENSION);
  const scale = options.scale ?? DEFAULT_TRIP_MAP_SIZE.scale;
  const pickupTrimmed = pickup.trim();
  const dropoffTrimmed = dropoff.trim();

  const params = new URLSearchParams({
    size: `${width}x${height}`,
    scale: String(scale),
    maptype: 'roadmap',
    key: apiKey,
  });

  appendMarker(params, 'blue', 'A', pickupTrimmed);
  appendMarker(params, 'red', 'B', dropoffTrimmed);
  params.append(
    'path',
    `color:${BRAND_ROUTE_COLOR}|weight:${ROUTE_WEIGHT}|${pickupTrimmed}|${dropoffTrimmed}`
  );
  params.append('visible', `${pickupTrimmed}|${dropoffTrimmed}`);

  return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
}