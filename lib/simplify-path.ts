// Douglas-Peucker algorithm for polyline simplification
// Reduces number of points while preserving the shape of the path.
// Works with { lat, lng } coordinates (in degrees).
// epsilon: tolerance in degrees (0.0001 ≈ 11 meters at equator; adjust based on needs, e.g. 0.00005 for finer detail)

export interface LatLngPoint {
  lat: number;
  lng: number;
}

function perpendicularDistance(point: LatLngPoint, lineStart: LatLngPoint, lineEnd: LatLngPoint): number {
  const dx = lineEnd.lng - lineStart.lng;
  const dy = lineEnd.lat - lineStart.lat;

  if (dx === 0 && dy === 0) {
    // Line start and end are the same point
    return Math.hypot(point.lng - lineStart.lng, point.lat - lineStart.lat);
  }

  // Projection factor
  const t = ((point.lng - lineStart.lng) * dx + (point.lat - lineStart.lat) * dy) / (dx * dx + dy * dy);

  // Closest point on the line segment
  let closestLng: number;
  let closestLat: number;

  if (t < 0) {
    closestLng = lineStart.lng;
    closestLat = lineStart.lat;
  } else if (t > 1) {
    closestLng = lineEnd.lng;
    closestLat = lineEnd.lat;
  } else {
    closestLng = lineStart.lng + t * dx;
    closestLat = lineStart.lat + t * dy;
  }

  return Math.hypot(point.lng - closestLng, point.lat - closestLat);
}

export function douglasPeucker(points: LatLngPoint[], epsilon: number): LatLngPoint[] {
  if (points.length <= 2) {
    return [...points];
  }

  // Find the point with the maximum distance from the line between first and last
  let dmax = 0;
  let index = 0;
  const end = points.length - 1;

  for (let i = 1; i < end; i++) {
    const d = perpendicularDistance(points[i], points[0], points[end]);
    if (d > dmax) {
      index = i;
      dmax = d;
    }
  }

  // If max distance is greater than epsilon, recursively simplify
  if (dmax > epsilon) {
    // Recursive calls
    const rec1 = douglasPeucker(points.slice(0, index + 1), epsilon);
    const rec2 = douglasPeucker(points.slice(index), epsilon);

    // Concatenate, removing duplicate at join point
    return rec1.slice(0, -1).concat(rec2);
  } else {
    // All points between are within tolerance — just keep endpoints
    return [points[0], points[end]];
  }
}

// Convenience wrapper with sensible defaults for GPS lat/lng (degrees)
export function simplifyPath(
  points: LatLngPoint[],
  options: { epsilon?: number; maxPoints?: number } = {}
): LatLngPoint[] {
  if (!points || points.length <= 2) return points ? [...points] : [];

  const epsilon = options.epsilon ?? 0.0001; // ~10-11 meters default tolerance
  let simplified = douglasPeucker(points, epsilon);

  // Optional hard cap for extreme cases (defense in depth)
  const maxPoints = options.maxPoints ?? 400;
  if (simplified.length > maxPoints) {
    const step = Math.ceil(simplified.length / maxPoints);
    simplified = simplified.filter((_, i) => i % step === 0 || i === simplified.length - 1);
  }

  return simplified;
}
