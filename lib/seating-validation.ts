import { suggestPassengerCapacity } from './vehicle-capacity';

export type SeatingApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface DriverSeatingProfile {
  vehicle_year?: number | null;
  vehicle_make?: string | null;
  vehicle_model?: string | null;
  passenger_capacity?: number | null;
  seating_override_note?: string | null;
  seating_approval_status?: SeatingApprovalStatus | null;
}

export interface SeatingCheckResult {
  ok: boolean;
  error?: string;
  code?:
    | 'missing_vehicle'
    | 'missing_capacity'
    | 'pending_approval'
    | 'rejected'
    | 'insufficient_capacity';
}

export function canDriverSubmitOffers(profile: DriverSeatingProfile): SeatingCheckResult {
  if (!profile.vehicle_year || !profile.vehicle_make?.trim() || !profile.vehicle_model?.trim()) {
    return {
      ok: false,
      code: 'missing_vehicle',
      error:
        'Complete your vehicle details on your Profile page before submitting offers.',
    };
  }

  const capacity = profile.passenger_capacity;
  if (capacity == null || capacity < 1) {
    return {
      ok: false,
      code: 'missing_capacity',
      error: 'Set your passenger capacity on your Profile page before submitting offers.',
    };
  }

  const status = profile.seating_approval_status ?? 'approved';
  if (status === 'pending') {
    return {
      ok: false,
      code: 'pending_approval',
      error:
        'Your seating capacity override is pending admin approval. You cannot submit offers until it is approved.',
    };
  }

  if (status === 'rejected') {
    return {
      ok: false,
      code: 'rejected',
      error:
        'Your seating capacity override was rejected. Update your vehicle details on your Profile page and resubmit.',
    };
  }

  return { ok: true };
}

export function tripFitsDriverCapacity(
  tripPassengers: number | null | undefined,
  driverCapacity: number | null | undefined
): SeatingCheckResult {
  const needed = tripPassengers ?? 1;
  const capacity = driverCapacity ?? 0;

  if (capacity < needed) {
    return {
      ok: false,
      code: 'insufficient_capacity',
      error: `This trip requires ${needed} passenger seat${needed !== 1 ? 's' : ''}, but your vehicle is approved for ${capacity}. Choose a trip with fewer passengers or update your seating capacity.`,
    };
  }

  return { ok: true };
}

export interface VehicleProfileSaveInput {
  vehicle_year: number;
  vehicle_make: string;
  vehicle_model: string;
  passenger_capacity: number;
  seating_override_note?: string;
}

export interface VehicleProfileSavePlan {
  seating_approval_status: SeatingApprovalStatus;
  seating_approved_at: string | null;
  seating_override_note: string | null;
  requiresNote: boolean;
  suggestionMessage: string;
  suggestedPassengers: number | null;
  totalSeats: number | null;
}

export function planVehicleProfileSave(input: VehicleProfileSaveInput): VehicleProfileSavePlan {
  const suggestion = suggestPassengerCapacity(
    input.vehicle_year,
    input.vehicle_make,
    input.vehicle_model
  );

  const suggested = suggestion.suggestedPassengers;
  const capacity = input.passenger_capacity;

  const isOverride =
    suggested != null ? capacity !== suggested : true;

  if (isOverride) {
    const note = input.seating_override_note?.trim() ?? '';
    return {
      seating_approval_status: 'pending',
      seating_approved_at: null,
      seating_override_note: note || null,
      requiresNote: note.length < 10,
      suggestionMessage: suggestion.message,
      suggestedPassengers: suggested,
      totalSeats: suggestion.totalSeats,
    };
  }

  return {
    seating_approval_status: 'approved',
    seating_approved_at: new Date().toISOString(),
    seating_override_note: null,
    requiresNote: false,
    suggestionMessage: suggestion.message,
    suggestedPassengers: suggested,
    totalSeats: suggestion.totalSeats,
  };
}