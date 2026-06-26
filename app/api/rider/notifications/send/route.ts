import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { sendRiderNotification, type RiderNotificationType } from '@/lib/rider/notifications';

export const dynamic = 'force-dynamic';

const VALID_TYPES: RiderNotificationType[] = [
  'buffer_started',
  'assignment_confirmed',
  'driver_en_route',
  'trip_completed',
];

function isInternalAuthorized(request: NextRequest): boolean {
  const secret = process.env.NOTIFICATION_INTERNAL_SECRET || process.env.CRON_SECRET;
  if (!secret) return false;

  const auth = request.headers.get('authorization');
  if (auth === `Bearer ${secret}`) return true;

  return request.headers.get('x-internal-secret') === secret;
}

/**
 * POST /api/rider/notifications/send
 *
 * Internal endpoint for emitting rider notifications (API routes, cron, future DB webhooks).
 * Body: { riderId, tripId, type, metadata? }
 */
export async function POST(request: NextRequest) {
  if (!isInternalAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    let admin;
    try {
      admin = getSupabaseAdmin();
    } catch {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 503 });
    }

    const body = await request.json();
    const riderId = body.riderId as string | undefined;
    const tripId = body.tripId as string | undefined;
    const type = body.type as RiderNotificationType | undefined;
    const metadata = (body.metadata as Record<string, unknown>) ?? {};

    if (!riderId || !tripId || !type) {
      return NextResponse.json({ error: 'riderId, tripId, and type are required.' }, { status: 400 });
    }

    if (!VALID_TYPES.includes(type)) {
      return NextResponse.json({ error: `Invalid notification type: ${type}` }, { status: 400 });
    }

    const result = await sendRiderNotification(admin, { riderId, tripId, type, metadata });

    if (!result.ok) {
      return NextResponse.json({ error: result.error ?? 'Failed to send notification' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      notificationId: result.notificationId,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('notifications/send error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}