import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

/**
 * POST /api/trip-offers/approve
 * Approve a pending offer: assign driver to trip, reject other pending offers.
 * Uses service role after org ownership validation for reliable assignment.
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

    const body = await request.json();
    const offerId = body.offerId as string | undefined;

    if (!offerId) {
      return NextResponse.json({ error: 'offerId is required.' }, { status: 400 });
    }

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('role')
      .eq('id', auth.user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found.' }, { status: 404 });
    }

    if (profile.role !== 'organization') {
      return NextResponse.json(
        { error: 'Only organization accounts can approve offers.' },
        { status: 403 }
      );
    }

    const { data: offer, error: offerError } = await admin
      .from('trip_offers')
      .select('id, trip_id, driver_id, status')
      .eq('id', offerId)
      .single();

    if (offerError || !offer) {
      return NextResponse.json({ error: 'Offer not found.' }, { status: 404 });
    }

    if (offer.status !== 'pending') {
      return NextResponse.json(
        { error: `This offer is already ${offer.status} and cannot be approved again.` },
        { status: 400 }
      );
    }

    const { data: trip, error: tripError } = await admin
      .from('trips')
      .select('id, organization_id, status, assigned_driver_id, title')
      .eq('id', offer.trip_id)
      .single();

    if (tripError || !trip) {
      return NextResponse.json({ error: 'Trip not found.' }, { status: 404 });
    }

    if (trip.organization_id !== auth.user.id) {
      return NextResponse.json({ error: 'Forbidden — you do not own this trip.' }, { status: 403 });
    }

    if (trip.status !== 'open') {
      return NextResponse.json(
        {
          error: `This trip is "${trip.status}" and cannot accept new driver assignments.`,
        },
        { status: 400 }
      );
    }

    if (trip.assigned_driver_id) {
      return NextResponse.json(
        { error: 'This trip already has an assigned driver.' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    const { error: approveError } = await admin
      .from('trip_offers')
      .update({ status: 'approved' })
      .eq('id', offerId);

    if (approveError) {
      console.error('Approve offer failed:', approveError);
      return NextResponse.json({ error: approveError.message }, { status: 500 });
    }

    const { data: updatedTrip, error: tripUpdateError } = await admin
      .from('trips')
      .update({
        status: 'assigned',
        assigned_driver_id: offer.driver_id,
        updated_at: now,
      })
      .eq('id', trip.id)
      .select('id, status, assigned_driver_id, title')
      .single();

    if (tripUpdateError || !updatedTrip) {
      console.error('Trip assignment failed:', tripUpdateError);
      // Roll back offer approval so state stays consistent
      await admin.from('trip_offers').update({ status: 'pending' }).eq('id', offerId);
      return NextResponse.json(
        {
          error: `Failed to assign driver to trip: ${tripUpdateError?.message ?? 'unknown error'}`,
        },
        { status: 500 }
      );
    }

    const { error: rejectError } = await admin
      .from('trip_offers')
      .update({ status: 'rejected' })
      .eq('trip_id', trip.id)
      .neq('id', offerId)
      .eq('status', 'pending');

    if (rejectError) {
      console.error('Reject other offers failed:', rejectError);
      // Trip is assigned; log but don't fail the whole operation
    }

    return NextResponse.json({
      success: true,
      message: 'Offer approved. Driver assigned and other pending offers rejected.',
      trip: updatedTrip,
      offer: { id: offer.id, driver_id: offer.driver_id, status: 'approved' },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('trip-offers approve error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}