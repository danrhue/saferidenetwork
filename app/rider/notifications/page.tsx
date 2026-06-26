'use client';

/**
 * Rider notifications — in-app feed and channel preferences (email, SMS, in-app).
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { authFetch } from '@/lib/auth-fetch';
import RiderBackLink from '@/components/rider/RiderBackLink';
import RiderLoadingSpinner from '@/components/rider/RiderLoadingSpinner';
import {
  notificationTypeLabel,
  type RiderNotificationPreferences,
} from '@/lib/rider/notifications';

type NotificationItem = {
  id: string;
  trip_id: string | null;
  type: string;
  title: string;
  body: string;
  action_url: string | null;
  read_at: string | null;
  created_at: string;
};

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const DEFAULT_PREFERENCES: RiderNotificationPreferences = {
  email_enabled: true,
  in_app_enabled: true,
  sms_enabled: false,
};

export default function RiderNotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [preferences, setPreferences] = useState<RiderNotificationPreferences>(DEFAULT_PREFERENCES);
  const [prefsLoading, setPrefsLoading] = useState(true);
  const [prefsSaving, setPrefsSaving] = useState(false);
  const [prefsMessage, setPrefsMessage] = useState('');
  const [riderPhone, setRiderPhone] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const res = await authFetch('/api/rider/notifications');
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to load notifications');
      }

      setNotifications(data.notifications ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPreferences = useCallback(async () => {
    setPrefsLoading(true);
    try {
      const res = await authFetch('/api/rider/notifications/preferences');
      const data = await res.json();
      if (res.ok && data.preferences) {
        setPreferences(data.preferences);
      }
    } catch {
      // Keep defaults on failure
    } finally {
      setPrefsLoading(false);
    }
  }, []);

  const updatePreference = async (
    key: keyof RiderNotificationPreferences,
    value: boolean
  ) => {
    const previous = preferences;
    setPreferences((p) => ({ ...p, [key]: value }));
    setPrefsSaving(true);
    setPrefsMessage('');

    try {
      const res = await authFetch('/api/rider/notifications/preferences', {
        method: 'PATCH',
        body: JSON.stringify({ [key]: value }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to save preferences');
      }

      if (data.preferences) {
        setPreferences(data.preferences);
      }
      setPrefsMessage('Preferences saved');
      setTimeout(() => setPrefsMessage(''), 2500);
    } catch (err: unknown) {
      setPreferences(previous);
      setPrefsMessage(err instanceof Error ? err.message : 'Failed to save preferences');
    } finally {
      setPrefsSaving(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    fetchPreferences();

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from('profiles')
        .select('phone')
        .eq('id', user.id)
        .single()
        .then(({ data }) => setRiderPhone(data?.phone?.trim() || null));
    });
  }, [fetchNotifications, fetchPreferences]);

  const markAsRead = async (notificationId: string) => {
    await authFetch('/api/rider/notifications', {
      method: 'PATCH',
      body: JSON.stringify({ notificationId }),
    });

    setNotifications((prev) =>
      prev.map((n) =>
        n.id === notificationId ? { ...n, read_at: new Date().toISOString() } : n
      )
    );
  };

  const markAllRead = async () => {
    await authFetch('/api/rider/notifications', {
      method: 'PATCH',
      body: JSON.stringify({ markAllRead: true }),
    });

    setNotifications((prev) =>
      prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() }))
    );
  };

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  return (
    <div className="mx-auto max-w-2xl">
      <RiderBackLink href="/rider/dashboard" label="Back to dashboard" />

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-blue-950">Notifications</h1>
          <p className="mt-1 text-blue-800">Trip updates, driver matches, and ride status.</p>
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={markAllRead}
            className="text-sm font-medium text-[#1E3A8A] hover:underline"
          >
            Mark all as read
          </button>
        )}
      </div>

      <div className="mb-6 rounded-2xl border border-blue-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-blue-800">
          Notification preferences
        </h2>
        <p className="mt-1 text-xs text-blue-700">
          Choose how you receive trip updates. SMS requires a phone number on your profile.
        </p>

        {prefsLoading ? (
          <div className="mt-4 h-16 animate-pulse rounded-xl bg-blue-50" />
        ) : (
          <ul className="mt-4 space-y-3">
            {(
              [
                {
                  key: 'in_app_enabled' as const,
                  label: 'In-app notifications',
                  description: 'Show updates in your notification center',
                },
                {
                  key: 'email_enabled' as const,
                  label: 'Email',
                  description: 'Trip updates sent to your account email',
                },
                {
                  key: 'sms_enabled' as const,
                  label: 'SMS text messages',
                  description: 'Key trip alerts via text (driver matched, en route, completed)',
                },
              ] as const
            ).map((item) => (
              <li
                key={item.key}
                className="flex items-center justify-between gap-4 rounded-xl border border-blue-100 bg-blue-50/40 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-blue-950">{item.label}</p>
                  <p className="text-xs text-blue-700">{item.description}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={preferences[item.key]}
                  disabled={prefsSaving}
                  onClick={() => updatePreference(item.key, !preferences[item.key])}
                  className={`relative h-7 w-12 shrink-0 rounded-full transition ${
                    preferences[item.key] ? 'bg-[#1E3A8A]' : 'bg-blue-200'
                  } disabled:opacity-50`}
                >
                  <span
                    className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${
                      preferences[item.key] ? 'left-5' : 'left-0.5'
                    }`}
                  />
                </button>
              </li>
            ))}
          </ul>
        )}

        {preferences.sms_enabled && !riderPhone && (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            SMS is enabled but no phone number is on file.{' '}
            <Link href="/rider/profile" className="font-semibold underline">
              Add your phone
            </Link>{' '}
            to receive text alerts.
          </p>
        )}

        {prefsMessage && (
          <p className="mt-3 text-xs font-medium text-blue-800">{prefsMessage}</p>
        )}
      </div>

      {loading ? (
        <RiderLoadingSpinner message="Loading notifications..." />
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">
          {error}
          <button
            type="button"
            onClick={fetchNotifications}
            className="mt-3 block w-full text-[#1E3A8A] hover:underline"
          >
            Try again
          </button>
        </div>
      ) : notifications.length === 0 ? (
        <div className="rounded-2xl border border-blue-200 bg-white p-8 text-center shadow-sm">
          <p className="text-lg font-semibold text-blue-950">No notifications yet</p>
          <p className="mt-2 text-sm text-blue-800">
            When a driver is matched or your trip status changes, updates will appear here.
          </p>
          <Link
            href="/rider/trips/new"
            className="mt-6 inline-flex rounded-xl bg-[#1E3A8A] px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-900"
          >
            Request a Ride
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {notifications.map((n) => (
            <li key={n.id}>
              <div
                className={`rounded-2xl border p-5 shadow-sm transition ${
                  n.read_at
                    ? 'border-blue-100 bg-white'
                    : 'border-blue-200 bg-blue-50/60'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-blue-950">{n.title}</p>
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-800">
                        {notificationTypeLabel(n.type)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-blue-800">{n.body}</p>
                    <p className="mt-2 text-xs text-blue-600">{formatRelativeTime(n.created_at)}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  {n.action_url && (
                    <Link
                      href={n.action_url}
                      onClick={() => !n.read_at && markAsRead(n.id)}
                      className="inline-flex rounded-xl bg-[#1E3A8A] px-4 py-2 text-sm font-semibold text-white hover:bg-blue-900"
                    >
                      View
                    </Link>
                  )}
                  {!n.read_at && (
                    <button
                      type="button"
                      onClick={() => markAsRead(n.id)}
                      className="text-sm font-medium text-blue-800 hover:underline"
                    >
                      Mark read
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}