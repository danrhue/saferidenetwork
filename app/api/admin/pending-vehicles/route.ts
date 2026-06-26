import { NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/admin-auth';
import { enrichDriverProfiles } from '@/lib/driver-profile';
import { suggestPassengerCapacity } from '@/lib/vehicle-capacity';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireAdminUser();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { data, error } = await auth.admin
    .from('profiles')
    .select(
      'id, full_name, phone, vehicle_make, vehicle_model, vehicle_year, passenger_capacity, seating_approval_status, seating_override_note, created_at, updated_at'
    )
    .eq('role', 'driver')
    .eq('seating_approval_status', 'pending')
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Pending vehicles fetch error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const enrichedDrivers = await enrichDriverProfiles(auth.admin, data ?? []);

  const vehicles = enrichedDrivers.map((row) => {
    const suggestion = suggestPassengerCapacity(
      row.vehicle_year as number | null,
      row.vehicle_make as string | null,
      row.vehicle_model as string | null
    );

    return {
      ...row,
      suggested_passengers: suggestion.suggestedPassengers,
      suggested_total_seats: suggestion.totalSeats,
      suggestion_message: suggestion.message,
    };
  });

  return NextResponse.json(vehicles);
}