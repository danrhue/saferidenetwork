/** Shared date/location formatting for Rider Portal pages. */

export function formatPickupTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatDateTime(iso: string): string {
  return formatPickupTime(iso);
}

export function truncateLocation(location: string, max = 48): string {
  const trimmed = location.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

export function routeSummary(
  pickup: string,
  dropoff: string,
  maxEach = 32
): string {
  return `${truncateLocation(pickup, maxEach)} → ${truncateLocation(dropoff, maxEach)}`;
}