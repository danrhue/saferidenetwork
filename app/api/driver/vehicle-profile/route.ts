import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { planVehicleProfileSave } from '@/lib/seating-validation';

export const dynamic = 'force-dynamic';

/**
 * POST /api/driver/vehicle-profile
 * Save driver vehicle details and seating capacity with smart approval logic.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized — please sign in again.' }, { status: 401 });
    }

    let admin;
    try {
      admin = getSupabaseAdmin();
    } catch {
      return NextResponse.json(
        { error: 'Server configuration error: SUPABASE_SERVICE_ROLE_KEY is missing.' },
        { status: 503 }
      );
    }

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('role')
      .eq('id', auth.user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found.' }, { status: 404 });
    }

    if (profile.role === 'organization') {
      return NextResponse.json(
        { error: 'Vehicle seating is only configured for driver accounts.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const vehicleYear = Number(body.vehicle_year);
    const vehicleMake = typeof body.vehicle_make === 'string' ? body.vehicle_make.trim() : '';
    const vehicleModel = typeof body.vehicle_model === 'string' ? body.vehicle_model.trim() : '';
    const passengerCapacity = Number(body.passenger_capacity);
    const overrideNote =
      typeof body.seating_override_note === 'string' ? body.seating_override_note.trim() : '';

    if (!Number.isInteger(vehicleYear) || vehicleYear < 1980 || vehicleYear > new Date().getFullYear() + 1) {
      return NextResponse.json({ error: 'Enter a valid vehicle year.' }, { status: 400 });
    }
    if (!vehicleMake) {
      return NextResponse.json({ error: 'Vehicle make is required.' }, { status: 400 });
    }
    if (!vehicleModel) {
      return NextResponse.json({ error: 'Vehicle model is required.' }, { status: 400 });
    }
    if (!Number.isInteger(passengerCapacity) || passengerCapacity < 1 || passengerCapacity > 50) {
      return NextResponse.json(
        { error: 'Passenger capacity must be a whole number between 1 and 50.' },
        { status: 400 }
      );
    }

    const plan = planVehicleProfileSave({
      vehicle_year: vehicleYear,
      vehicle_make: vehicleMake,
      vehicle_model: vehicleModel,
      passenger_capacity: passengerCapacity,
      seating_override_note: overrideNote,
    });

    if (plan.requiresNote) {
      return NextResponse.json(
        {
          error:
            'When your capacity differs from the suggestion, provide a short note (at least 10 characters) explaining why.',
        },
        { status: 400 }
      );
    }

    const { data: updated, error: updateError } = await admin
      .from('profiles')
      .update({
        vehicle_year: vehicleYear,
        vehicle_make: vehicleMake,
        vehicle_model: vehicleModel,
        passenger_capacity: passengerCapacity,
        seating_override_note: plan.seating_override_note,
        seating_approval_status: plan.seating_approval_status,
        seating_approved_at: plan.seating_approved_at,
        updated_at: new Date().toISOString(),
      })
      .eq('id', auth.user.id)
      .select(
        'vehicle_year, vehicle_make, vehicle_model, passenger_capacity, seating_override_note, seating_approval_status, seating_approved_at'
      )
      .single();

    if (updateError) {
      console.error('Vehicle profile update failed:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      profile: updated,
      suggestionMessage: plan.suggestionMessage,
      suggestedPassengers: plan.suggestedPassengers,
      totalSeats: plan.totalSeats,
      pendingApproval: plan.seating_approval_status === 'pending',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('vehicle-profile POST error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}