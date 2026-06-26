import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export type RiderNotificationPreferences = {
  email_enabled: boolean;
  in_app_enabled: boolean;
  sms_enabled: boolean;
};

const DEFAULT_PREFERENCES: RiderNotificationPreferences = {
  email_enabled: true,
  in_app_enabled: true,
  sms_enabled: false,
};

/**
 * GET /api/rider/notifications/preferences
 * PATCH /api/rider/notifications/preferences — body: { email_enabled?, in_app_enabled?, sms_enabled? }
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

    const { data, error } = await admin
      .from('rider_notification_preferences')
      .select('email_enabled, in_app_enabled, sms_enabled')
      .eq('rider_id', auth.user.id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      preferences: {
        email_enabled: data?.email_enabled ?? DEFAULT_PREFERENCES.email_enabled,
        in_app_enabled: data?.in_app_enabled ?? DEFAULT_PREFERENCES.in_app_enabled,
        sms_enabled: data?.sms_enabled ?? DEFAULT_PREFERENCES.sms_enabled,
      },
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

    const { data: profile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', auth.user.id)
      .single();

    if (profile?.role !== 'rider') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const updates: Partial<RiderNotificationPreferences> = {};

    if (typeof body.email_enabled === 'boolean') {
      updates.email_enabled = body.email_enabled;
    }
    if (typeof body.in_app_enabled === 'boolean') {
      updates.in_app_enabled = body.in_app_enabled;
    }
    if (typeof body.sms_enabled === 'boolean') {
      updates.sms_enabled = body.sms_enabled;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'At least one preference field is required.' },
        { status: 400 }
      );
    }

    const { data: existing } = await admin
      .from('rider_notification_preferences')
      .select('rider_id')
      .eq('rider_id', auth.user.id)
      .maybeSingle();

    const now = new Date().toISOString();

    if (existing) {
      const { data, error } = await admin
        .from('rider_notification_preferences')
        .update({ ...updates, updated_at: now })
        .eq('rider_id', auth.user.id)
        .select('email_enabled, in_app_enabled, sms_enabled')
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ preferences: data });
    }

    const { data, error } = await admin
      .from('rider_notification_preferences')
      .insert({
        rider_id: auth.user.id,
        email_enabled: updates.email_enabled ?? DEFAULT_PREFERENCES.email_enabled,
        in_app_enabled: updates.in_app_enabled ?? DEFAULT_PREFERENCES.in_app_enabled,
        sms_enabled: updates.sms_enabled ?? DEFAULT_PREFERENCES.sms_enabled,
        updated_at: now,
      })
      .select('email_enabled, in_app_enabled, sms_enabled')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ preferences: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}