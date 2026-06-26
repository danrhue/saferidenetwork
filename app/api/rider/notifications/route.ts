import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

/**
 * GET /api/rider/notifications — list in-app notifications for the authenticated rider
 * PATCH /api/rider/notifications — mark notification(s) as read
 */
export async function GET(request: NextRequest) {
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

    const { data: profile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', auth.user.id)
      .single();

    if (profile?.role !== 'rider') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const limit = Math.min(parseInt(request.nextUrl.searchParams.get('limit') ?? '50', 10), 100);

    const { data: notifications, error } = await admin
      .from('rider_notifications')
      .select('id, trip_id, type, title, body, action_url, read_at, created_at')
      .eq('rider_id', auth.user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { count: unreadCount } = await admin
      .from('rider_notifications')
      .select('id', { count: 'exact', head: true })
      .eq('rider_id', auth.user.id)
      .is('read_at', null);

    return NextResponse.json({
      notifications: notifications ?? [],
      unreadCount: unreadCount ?? 0,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
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
    const notificationId = body.notificationId as string | undefined;
    const markAllRead = body.markAllRead === true;

    const now = new Date().toISOString();

    if (markAllRead) {
      const { error } = await admin
        .from('rider_notifications')
        .update({ read_at: now })
        .eq('rider_id', auth.user.id)
        .is('read_at', null);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, markedAll: true });
    }

    if (!notificationId) {
      return NextResponse.json({ error: 'notificationId or markAllRead required' }, { status: 400 });
    }

    const { error } = await admin
      .from('rider_notifications')
      .update({ read_at: now })
      .eq('id', notificationId)
      .eq('rider_id', auth.user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, notificationId });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}