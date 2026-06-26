// Geospatial utilities for real-time geofencing in admin monitoring.
// Uses Haversine formula for accurate meter distances on the sphere (no Google dependency required for detection).

export interface LatLng {
  lat: number;
  lng: number;
}

export interface GeofenceZone {
  id: 'pickup' | 'dropoff' | string;
  label: string;
  center: LatLng;
  radiusMeters: number;
}

/**
 * Haversine distance between two lat/lng points, in meters.
 */
export function haversineDistanceMeters(a: LatLng, b: LatLng): number {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);

  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);

  const c =
    sinDLat * sinDLat +
    sinDLng * sinDLng * Math.cos(lat1) * Math.cos(lat2);

  return 2 * R * Math.asin(Math.sqrt(c));
}

export type GeofenceStatus = 'inside' | 'outside';

export interface GeofenceEvent {
  timestamp: string; // ISO
  zoneId: 'pickup' | 'dropoff' | string;
  zoneLabel: string;
  type: 'enter' | 'exit';
  position: LatLng;
}

/**
 * Determine current inside/outside status for a point against a zone.
 */
export function computeStatus(point: LatLng, zone: GeofenceZone): GeofenceStatus {
  const dist = haversineDistanceMeters(point, zone.center);
  return dist <= zone.radiusMeters ? 'inside' : 'outside';
}

/**
 * Given a sequence of points (historical path + latest), compute the set of transition events
 * and the final status per zone. This allows deterministic replay of geofence history.
 */
export function processGeofenceHistory(
  points: LatLng[],
  zones: GeofenceZone[]
): { events: GeofenceEvent[]; finalStatuses: Record<string, GeofenceStatus> } {
  const events: GeofenceEvent[] = [];
  const statuses: Record<string, GeofenceStatus> = {};

  // Seed initial statuses as 'outside' for stability
  zones.forEach((z) => {
    statuses[z.id] = 'outside';
  });

  if (!points || points.length === 0) {
    return { events, finalStatuses: statuses };
  }

  // Process sequentially
  for (let i = 0; i < points.length; i++) {
    const pt = points[i];
    const time = new Date(Date.now() - (points.length - 1 - i) * 15000).toISOString(); // approximate recency for demo; real use would use recorded_at

    zones.forEach((zone) => {
      const newStatus = computeStatus(pt, zone);
      const prev = statuses[zone.id];
      if (newStatus !== prev) {
        events.push({
          timestamp: time,
          zoneId: zone.id,
          zoneLabel: zone.label,
          type: newStatus === 'inside' ? 'enter' : 'exit',
          position: pt,
        });
        statuses[zone.id] = newStatus;
      }
    });
  }

  return { events, finalStatuses: statuses };
}

/**
 * On a single new point arrival (realtime), detect only the transitions vs previous statuses.
 * Mutates or returns new events + updated statuses (pure: returns new arrays/objects).
 */
export function detectGeofenceTransitions(
  point: LatLng,
  zones: GeofenceZone[],
  prevStatuses: Record<string, GeofenceStatus>
): { newEvents: GeofenceEvent[]; newStatuses: Record<string, GeofenceStatus> } {
  const newStatuses: Record<string, GeofenceStatus> = { ...prevStatuses };
  const newEvents: GeofenceEvent[] = [];
  const now = new Date().toISOString();

  zones.forEach((zone) => {
    const newStatus = computeStatus(point, zone);
    const prev = prevStatuses[zone.id] ?? 'outside';
    if (newStatus !== prev) {
      newEvents.push({
        timestamp: now,
        zoneId: zone.id,
        zoneLabel: zone.label,
        type: newStatus === 'inside' ? 'enter' : 'exit',
        position: point,
      });
      newStatuses[zone.id] = newStatus;
    }
  });

  return { newEvents, newStatuses };
}

export const DEFAULT_GEOFENCE_RADIUS_METERS = 200; // Simple circular pickup / dropoff zones. Tunable.