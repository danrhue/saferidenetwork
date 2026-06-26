/**
 * Common vehicle specs for passenger capacity suggestions.
 * Passenger capacity = total seats − 1 (driver seat).
 */

export interface VehicleSpec {
  make: string;
  model: string;
  /** Inclusive year range when known; omit for all years */
  yearMin?: number;
  yearMax?: number;
  totalSeats: number;
}

export interface CapacitySuggestion {
  matched: boolean;
  totalSeats: number | null;
  suggestedPassengers: number | null;
  message: string;
}

/** Normalize for fuzzy matching */
function norm(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

export const COMMON_VEHICLES: VehicleSpec[] = [
  { make: 'Toyota', model: 'Sienna', yearMin: 2011, totalSeats: 8 },
  { make: 'Toyota', model: 'Highlander', yearMin: 2014, totalSeats: 8 },
  { make: 'Honda', model: 'Odyssey', yearMin: 2011, totalSeats: 8 },
  { make: 'Honda', model: 'Pilot', yearMin: 2016, totalSeats: 8 },
  { make: 'Chrysler', model: 'Pacifica', yearMin: 2017, totalSeats: 8 },
  { make: 'Dodge', model: 'Grand Caravan', yearMin: 2008, totalSeats: 7 },
  { make: 'Kia', model: 'Carnival', yearMin: 2022, totalSeats: 8 },
  { make: 'Kia', model: 'Sedona', yearMin: 2015, yearMax: 2021, totalSeats: 8 },
  { make: 'Ford', model: 'Transit', yearMin: 2015, totalSeats: 12 },
  { make: 'Ford', model: 'Transit Connect', yearMin: 2014, totalSeats: 7 },
  { make: 'Mercedes-Benz', model: 'Sprinter', yearMin: 2015, totalSeats: 12 },
  { make: 'Chevrolet', model: 'Suburban', yearMin: 2015, totalSeats: 8 },
  { make: 'Chevrolet', model: 'Tahoe', yearMin: 2015, totalSeats: 8 },
  { make: 'GMC', model: 'Yukon XL', yearMin: 2015, totalSeats: 8 },
  { make: 'Nissan', model: 'NV Passenger', yearMin: 2012, totalSeats: 12 },
  { make: 'Nissan', model: 'Quest', yearMin: 2011, yearMax: 2017, totalSeats: 7 },
  { make: 'Toyota', model: 'Camry', yearMin: 2012, totalSeats: 5 },
  { make: 'Honda', model: 'Accord', yearMin: 2013, totalSeats: 5 },
  { make: 'Toyota', model: 'Corolla', yearMin: 2014, totalSeats: 5 },
  { make: 'Ford', model: 'Explorer', yearMin: 2016, totalSeats: 7 },
  { make: 'Jeep', model: 'Grand Cherokee L', yearMin: 2021, totalSeats: 7 },
  { make: 'Tesla', model: 'Model Y', yearMin: 2020, totalSeats: 7 },
  { make: 'Tesla', model: 'Model 3', yearMin: 2017, totalSeats: 5 },
  { make: 'Hyundai', model: 'Palisade', yearMin: 2020, totalSeats: 8 },
  { make: 'Hyundai', model: 'Santa Fe', yearMin: 2019, totalSeats: 7 },
];

function modelMatches(specModel: string, inputModel: string): boolean {
  const a = norm(specModel);
  const b = norm(inputModel);
  return a === b || b.includes(a) || a.includes(b);
}

function yearMatches(spec: VehicleSpec, year: number): boolean {
  if (spec.yearMin != null && year < spec.yearMin) return false;
  if (spec.yearMax != null && year > spec.yearMax) return false;
  return true;
}

export function findVehicleSpec(
  year: number,
  make: string,
  model: string
): VehicleSpec | null {
  if (!make.trim() || !model.trim() || !Number.isFinite(year)) return null;

  const makeNorm = norm(make);
  const matches = COMMON_VEHICLES.filter(
    (v) => norm(v.make) === makeNorm && modelMatches(v.model, model) && yearMatches(v, year)
  );

  if (matches.length === 0) return null;
  // Prefer longest model name match (more specific)
  return matches.sort((a, b) => b.model.length - a.model.length)[0];
}

export function suggestPassengerCapacity(
  year: number | null | undefined,
  make: string | null | undefined,
  model: string | null | undefined
): CapacitySuggestion {
  if (year == null || !make?.trim() || !model?.trim()) {
    return {
      matched: false,
      totalSeats: null,
      suggestedPassengers: null,
      message: 'Enter year, make, and model to get a seating suggestion.',
    };
  }

  const spec = findVehicleSpec(year, make, model);
  if (!spec) {
    return {
      matched: false,
      totalSeats: null,
      suggestedPassengers: null,
      message:
        'No match in our vehicle database. Enter your passenger capacity manually — overrides require admin approval.',
    };
  }

  const suggested = Math.max(spec.totalSeats - 1, 1);
  return {
    matched: true,
    totalSeats: spec.totalSeats,
    suggestedPassengers: suggested,
    message: `Suggested: ${suggested} passenger${suggested !== 1 ? 's' : ''} (based on ${spec.totalSeats} total seats − 1 driver seat)`,
  };
}

export function passengerCapacityFromTotalSeats(totalSeats: number): number {
  return Math.max(totalSeats - 1, 1);
}