/**
 * Reduces a full street address to a general area for marketplace browsing.
 * Drivers see full addresses only after a trip is assigned to them.
 */
export function maskTripLocation(address: string | null | undefined): string {
  const trimmed = (address ?? '').trim();
  if (!trimmed) return 'Area unavailable';

  const zipMatch = trimmed.match(/\b(\d{5})(?:-\d{4})?\b/);
  if (zipMatch) {
    const cityState = extractCityState(trimmed);
    if (cityState) return `${cityState} (${zipMatch[1]} area)`;
    return `${zipMatch[1]} area`;
  }

  const cityState = extractCityState(trimmed);
  if (cityState) return `${cityState} area`;

  const parts = trimmed.split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[parts.length - 1]} area`;
  }

  const words = trimmed.split(/\s+/);
  if (words.length > 3) {
    return `${words.slice(-2).join(' ')} area`;
  }

  return 'General area';
}

function extractCityState(address: string): string | null {
  const parts = address.split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) return null;

  const last = parts[parts.length - 1];
  const city = parts.length >= 3 ? parts[parts.length - 2] : parts[0];
  const stateMatch = last.match(/\b([A-Z]{2})\b/i);
  const state = stateMatch?.[1]?.toUpperCase();

  if (city && state) return `${city}, ${state}`;
  if (city) return city;
  return null;
}

export function maskTripLocations<T extends { pickup_location: string; dropoff_location: string }>(
  trip: T
): T & { pickup_area: string; dropoff_area: string } {
  return {
    ...trip,
    pickup_area: maskTripLocation(trip.pickup_location),
    dropoff_area: maskTripLocation(trip.dropoff_location),
  };
}