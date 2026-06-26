/**
 * Rider notification orchestration — in-app, email, and SMS channels.
 * Triggered by auto-match, assignment finalize, and trip lifecycle APIs.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { emailLayout, sendEmail } from '@/lib/email';
import { sendSMS, normalizePhoneToE164 } from '@/lib/sms';
import { APP_URL } from '@/lib/stripe';

/** Phase 1 rider notification event types. */
export type RiderNotificationType =
  | 'buffer_started'
  | 'offer_received'
  | 'assignment_confirmed'
  | 'driver_en_route'
  | 'trip_completed';

export interface SendRiderNotificationParams {
  riderId: string;
  tripId: string;
  type: RiderNotificationType;
  metadata?: Record<string, unknown>;
}

export interface RiderNotificationRecord {
  id: string;
  rider_id: string;
  trip_id: string | null;
  type: string;
  title: string;
  body: string;
  action_url: string | null;
  read_at: string | null;
  created_at: string;
}

export type RiderNotificationPreferences = {
  email_enabled: boolean;
  in_app_enabled: boolean;
  sms_enabled: boolean;
};

type NotificationContent = {
  title: string;
  body: string;
  actionUrl: string;
  emailSubject: string;
  emailHtml: string;
  smsBody: string;
};

/** Max SMS per rider per hour (cost guard). */
const SMS_RATE_LIMIT_PER_HOUR = 10;

// Phase 2: Twilio delivery webhooks; branded SMS short links; push notifications

function formatPickupTime(iso: string | null | undefined): string {
  if (!iso) return 'soon';
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function buildNotificationContent(
  type: RiderNotificationType,
  trip: {
    id: string;
    pickup_time?: string | null;
    pickup_location?: string | null;
    dropoff_location?: string | null;
  },
  driverName: string | null,
  metadata: Record<string, unknown>
): NotificationContent {
  const tripUrl = `/rider/trips/${trip.id}`;
  const pendingUrl = `/rider/trips/${trip.id}/pending`;
  const absoluteTripUrl = `${APP_URL}${tripUrl}`;
  const bufferSeconds = (metadata.bufferSeconds as number) ?? 60;

  switch (type) {
    case 'buffer_started':
      return {
        title: 'Driver found — review now',
        body: `A driver has been found for your trip. You have ${bufferSeconds} seconds to review or cancel.`,
        actionUrl: pendingUrl,
        emailSubject: 'A driver is ready for your trip — confirm within 60 seconds',
        emailHtml: emailLayout(
          'Driver found for your trip',
          `<p>A vetted driver has been matched to your ride.</p>
           <p><strong>You have ${bufferSeconds} seconds</strong> to review their profile or decline before the assignment is confirmed automatically.</p>
           <p>Pickup: ${trip.pickup_location ?? '—'}<br/>Scheduled: ${formatPickupTime(trip.pickup_time)}</p>`,
          pendingUrl,
          'Review driver now'
        ),
        smsBody: `Safe Ride Network: A driver has been found. You have ${bufferSeconds} seconds to review. ${APP_URL}${pendingUrl}`,
      };

    case 'offer_received': {
      const driverLabel = driverName ?? 'A driver';
      const offersUrl = `/rider/trips/${trip.id}/offers`;
      return {
        title: 'New driver offer',
        body: `${driverLabel} submitted an offer on your trip. Review and choose your driver.`,
        actionUrl: offersUrl,
        emailSubject: 'New driver offer on your Safe Ride Network trip',
        emailHtml: emailLayout(
          'You have a new driver offer',
          `<p><strong>${driverLabel}</strong> would like to drive your trip.</p>
           <p>Pickup: ${trip.pickup_location ?? '—'}<br/>Scheduled: ${formatPickupTime(trip.pickup_time)}</p>
           <p>Sign in to compare offers and accept your preferred driver.</p>`,
          offersUrl,
          'Review offers'
        ),
        smsBody: `Safe Ride Network: ${driverLabel} offered on your trip. Review offers: ${APP_URL}${offersUrl}`,
      };
    }

    case 'assignment_confirmed': {
      const eta = formatPickupTime(trip.pickup_time);
      const driverLabel = driverName ?? 'Your driver';
      return {
        title: 'Driver confirmed',
        body: `Your driver ${driverLabel} has been confirmed. Scheduled pickup: ${eta}.`,
        actionUrl: tripUrl,
        emailSubject: `${driverLabel} is confirmed for your ride`,
        emailHtml: emailLayout(
          'Your driver is confirmed',
          `<p><strong>${driverLabel}</strong> has been assigned to your trip.</p>
           <p>Scheduled pickup: <strong>${eta}</strong></p>
           <p>Pickup: ${trip.pickup_location ?? '—'}<br/>Drop-off: ${trip.dropoff_location ?? '—'}</p>`,
          tripUrl,
          'View trip details'
        ),
        smsBody: `Safe Ride Network: Your driver ${driverLabel} is confirmed. Pickup ${eta}. ${absoluteTripUrl}`,
      };
    }

    case 'driver_en_route':
      return {
        title: 'Driver en route',
        body: 'Your driver is on the way. Track your trip live in the Rider Portal.',
        actionUrl: tripUrl,
        emailSubject: 'Your driver is on the way',
        emailHtml: emailLayout(
          'Your driver is on the way',
          `<p>${driverName ?? 'Your driver'} has started your trip and is en route to pickup.</p>
           <p>Open the Rider Portal to follow live trip progress.</p>`,
          tripUrl,
          'Track live'
        ),
        smsBody: `Safe Ride Network: Your driver is on the way. Track live: ${absoluteTripUrl}`,
      };

    case 'trip_completed':
      return {
        title: 'Trip completed',
        body: 'Your trip has been completed. View your receipt and rate your driver.',
        actionUrl: tripUrl,
        emailSubject: 'Your Safe Ride Network trip is complete',
        emailHtml: emailLayout(
          'Trip completed',
          `<p>Your ride has been completed safely. Thank you for using Safe Ride Network.</p>
           <p>View trip details to see your summary and rate ${driverName ?? 'your driver'}.</p>`,
          tripUrl,
          'View receipt & rate driver'
        ),
        smsBody: `Safe Ride Network: Your trip is complete. View receipt: ${absoluteTripUrl}`,
      };

    default:
      return {
        title: 'Trip update',
        body: 'You have a new update on your trip.',
        actionUrl: tripUrl,
        emailSubject: 'Trip update — Safe Ride Network',
        emailHtml: emailLayout('Trip update', '<p>You have a new update on your trip.</p>', tripUrl, 'View trip'),
        smsBody: `Safe Ride Network: Trip update. ${absoluteTripUrl}`,
      };
  }
}

async function getRiderPreferences(
  admin: SupabaseClient,
  riderId: string
): Promise<RiderNotificationPreferences> {
  const { data } = await admin
    .from('rider_notification_preferences')
    .select('email_enabled, in_app_enabled, sms_enabled')
    .eq('rider_id', riderId)
    .maybeSingle();

  return {
    email_enabled: data?.email_enabled ?? true,
    in_app_enabled: data?.in_app_enabled ?? true,
    sms_enabled: data?.sms_enabled ?? false,
  };
}

async function getRiderPhone(admin: SupabaseClient, riderId: string): Promise<string | null> {
  const { data } = await admin
    .from('profiles')
    .select('phone')
    .eq('id', riderId)
    .maybeSingle();

  const phone = data?.phone?.trim();
  if (!phone) return null;

  return normalizePhoneToE164(phone) ? phone : null;
}

/** Returns false if this trip+type SMS was already sent or hourly limit exceeded. */
async function canSendSms(
  admin: SupabaseClient,
  riderId: string,
  tripId: string,
  type: RiderNotificationType
): Promise<{ allowed: boolean; reason?: string }> {
  const { data: existing } = await admin
    .from('rider_sms_log')
    .select('id')
    .eq('trip_id', tripId)
    .eq('notification_type', type)
    .maybeSingle();

  if (existing) {
    return { allowed: false, reason: 'duplicate_trip_type' };
  }

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .from('rider_sms_log')
    .select('id', { count: 'exact', head: true })
    .eq('rider_id', riderId)
    .gte('created_at', oneHourAgo);

  if ((count ?? 0) >= SMS_RATE_LIMIT_PER_HOUR) {
    return { allowed: false, reason: 'hourly_rate_limit' };
  }

  return { allowed: true };
}

async function logSmsDelivery(
  admin: SupabaseClient,
  params: {
    riderId: string;
    tripId: string;
    type: RiderNotificationType;
    phone: string;
    provider: string;
    messageId?: string;
  }
): Promise<void> {
  const digits = params.phone.replace(/\D/g, '');
  const phoneLast4 = digits.slice(-4) || null;

  const { error } = await admin.from('rider_sms_log').insert({
    rider_id: params.riderId,
    trip_id: params.tripId,
    notification_type: params.type,
    phone_last4: phoneLast4,
    provider: params.provider,
    provider_message_id: params.messageId ?? null,
  });

  if (error) {
    // Unique constraint = duplicate; safe to ignore
    if (error.code !== '23505') {
      console.error('rider_sms_log insert failed:', error.message);
    }
  }
}

/**
 * Creates an in-app notification and optionally sends email and SMS to the rider.
 * Call from API routes after trip lifecycle events (auto-match, finalize, status changes).
 */
export async function sendRiderNotification(
  admin: SupabaseClient,
  params: SendRiderNotificationParams
): Promise<{ ok: boolean; notificationId?: string; smsSent?: boolean; error?: string }> {
  const { riderId, tripId, type, metadata = {} } = params;

  const { data: trip, error: tripError } = await admin
    .from('trips')
    .select('id, rider_id, pickup_time, pickup_location, dropoff_location, assigned_driver_id, trip_source')
    .eq('id', tripId)
    .single();

  if (tripError || !trip) {
    return { ok: false, error: 'Trip not found' };
  }

  if (trip.rider_id !== riderId) {
    return { ok: false, error: 'Trip does not belong to rider' };
  }

  let driverName: string | null = (metadata.driverName as string) ?? null;
  if (!driverName && trip.assigned_driver_id) {
    const { data: driver } = await admin
      .from('profiles')
      .select('full_name')
      .eq('id', trip.assigned_driver_id)
      .single();
    driverName = driver?.full_name ?? null;
  }

  const content = buildNotificationContent(type, trip, driverName, metadata);
  const prefs = await getRiderPreferences(admin, riderId);

  let notificationId: string | undefined;
  let emailSentAt: string | null = null;
  let smsSentAt: string | null = null;
  let smsSent = false;

  if (prefs.in_app_enabled) {
    const { data: inserted, error: insertError } = await admin
      .from('rider_notifications')
      .insert({
        rider_id: riderId,
        trip_id: tripId,
        type,
        title: content.title,
        body: content.body,
        action_url: content.actionUrl,
        metadata,
      })
      .select('id')
      .single();

    if (insertError) {
      // Phase 2: Queue failed in-app notifications for retry
      console.error('rider_notifications insert failed:', insertError.message);
      return { ok: false, error: insertError.message };
    }

    notificationId = inserted.id;
  }

  if (prefs.email_enabled) {
    const { data: authUser } = await admin.auth.admin.getUserById(riderId);
    const email = authUser?.user?.email;

    if (email) {
      const result = await sendEmail({
        to: email,
        subject: content.emailSubject,
        html: content.emailHtml,
        text: content.body,
      });

      if (result.sent && notificationId) {
        emailSentAt = new Date().toISOString();
        await admin
          .from('rider_notifications')
          .update({ email_sent_at: emailSentAt })
          .eq('id', notificationId);
      }
    }
  }

  if (prefs.sms_enabled) {
    const phone = await getRiderPhone(admin, riderId);

    if (!phone) {
      console.log('[SMS] Skipped (no_phone):', { riderId, tripId, type });
    } else {
      const smsCheck = await canSendSms(admin, riderId, tripId, type);

      if (smsCheck.allowed) {
        const smsResult = await sendSMS({
          to: phone,
          body: content.smsBody,
        });

        if (smsResult.sent) {
          smsSent = true;
          smsSentAt = new Date().toISOString();

          await logSmsDelivery(admin, {
            riderId,
            tripId,
            type,
            phone,
            provider: smsResult.provider,
            messageId: smsResult.messageId,
          });

          if (notificationId) {
            await admin
              .from('rider_notifications')
              .update({ sms_sent_at: smsSentAt })
              .eq('id', notificationId);
          }
        }
      } else {
        console.log(`[SMS] Skipped (${smsCheck.reason}):`, { riderId, tripId, type });
      }
    }
  }

  return { ok: true, notificationId, smsSent };
}

/** Resolve rider_id + driver name for assignment-confirmed notifications. */
export async function notifyAssignmentConfirmed(
  admin: SupabaseClient,
  tripId: string,
  driverId: string
): Promise<void> {
  const { data: trip } = await admin
    .from('trips')
    .select('rider_id')
    .eq('id', tripId)
    .single();

  if (!trip?.rider_id) return;

  const { data: driver } = await admin
    .from('profiles')
    .select('full_name')
    .eq('id', driverId)
    .single();

  await sendRiderNotification(admin, {
    riderId: trip.rider_id,
    tripId,
    type: 'assignment_confirmed',
    metadata: { driverName: driver?.full_name ?? undefined },
  });
}

export function notificationTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    buffer_started: 'Driver matched',
    offer_received: 'New offer',
    assignment_confirmed: 'Driver confirmed',
    driver_en_route: 'En route',
    trip_completed: 'Completed',
  };
  return labels[type] ?? type.replace(/_/g, ' ');
}

export function absoluteActionUrl(path: string | null): string {
  if (!path) return `${APP_URL}/rider/notifications`;
  return path.startsWith('http') ? path : `${APP_URL}${path}`;
}