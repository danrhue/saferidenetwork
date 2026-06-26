import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { sendRiderNotification, type RiderNotificationType } from '@/lib/rider/notifications';

export const dynamic = 'force-dynamic';

const LIFECYCLE_MAP: Record<string, RiderNotificationType> = {
  driver_en_route: 'driver_en_route',
  trip_completed: 'trip_completed',
};

/**
 * POST /api/rider/notifications/trip-lifecycle
 *
 * Called when a trip status changes (e.g. driver starts or completes a rider trip).
 * Body: { tripId, event: 'driver_en_route' | 'trip_completed' }
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let admin;
    try {
      admin = getSupabaseAdmin();
    } catch {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 503 });
    }

    const body = await request.json();
    const tripId = body.tripId as string | undefined;
    const event = body.event as string | undefined;

    if (!tripId || !event) {
      return NextResponse.json({ error: 'tripId and event are required.' }, { status: 400 });
    }

    const notificationType = LIFECYCLE_MAP[event];
    if (!notificationType) {
      return NextResponse.json({ error: `Invalid event: ${event}` }, { status: 400 });
    }

    const { data: trip, error: tripError } = await admin
      .from('trips')
      .select('id, rider_id, trip_source, assigned_driver_id, status')
      .eq('id', tripId)
      .single();

    if (tripError || !trip) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }

    if (!trip.rider_id || trip.trip_source !== 'rider') {
      return NextResponse.json({ error: 'Not a rider trip' }, { status: 400 });
    }

    // Only the assigned driver (or service) should trigger lifecycle notifications
    if (trip.assigned_driver_id !== auth.user.id) {
      return NextResponse.json({ error: 'Forbidden — not assigned to this trip' }, { status: 403 });
    }

    const expectedStatus = event === 'driver_en_route' ? 'in_progress' : 'completed';
    if (trip.status !== expectedStatus) {
      return NextResponse.json(
        { error: `Trip status must be ${expectedStatus} before sending ${event}` },
        { status: 400 }
      );
    }

    const result = await sendRiderNotification(admin, {
      riderId: trip.rider_id,
      tripId,
      type: notificationType,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error ?? 'Notification failed' }, { status: 500 });
    }

    return NextResponse.json({ success: true, notificationId: result.notificationId });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('trip-lifecycle notification error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}