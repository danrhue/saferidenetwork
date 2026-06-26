# Rider Portal — Safe Ride Network

Production-ready personal ride flow for authenticated riders (`profiles.role = 'rider'`).

## Key user flows

1. **Get a Ride funnel** (`/get-a-ride`) → saves draft to `sessionStorage` → sign-up with `?role=rider` → `/rider/trips/new` pre-filled.
2. **Trip request wizard** (`/rider/trips/new`) → 5 steps → Stripe Checkout → trip detail (`/rider/trips/[tripId]`).
3. **Auto-match buffer** — first driver offer starts 60s countdown → `/rider/trips/[tripId]/pending` → confirm or auto-finalize.
4. **Trip lifecycle** — assigned → in progress → completed; notifications via in-app, email (Resend), SMS (Twilio).
5. **Post-ride** — rate driver on completed trip detail; view history on My Trips.

## Directory map

| Path | Purpose |
|------|---------|
| `app/rider/` | Portal pages (dashboard, trips, profile, settings, notifications) |
| `components/rider/` | Reusable UI (badges, timeline, ratings, loading states) |
| `lib/rider/` | Business logic (notifications, assignment, reviews, trip draft, UI tokens) |
| `app/api/rider/` | Server APIs (checkout, assignment, notifications) |
| `supabase/rider_*.sql` | Migrations (auto-match, notifications, SMS, reviews, profile) |

## Shared UI conventions

Import from `lib/rider/ui.ts` for buttons/inputs and `lib/rider/format.ts` for dates.

Reusable components:

- `RiderLoadingSpinner` — consistent loading states
- `RiderEmptyState` — empty lists/tabs
- `RiderBackLink` — sub-page navigation (44px touch target)
- `RiderTrustBanner` — branding + dispatch contact

Brand color: `#1E3A8A` (primary buttons, accents).

## Notifications

`lib/rider/notifications.ts` → `sendRiderNotification()` handles:

| Event | Trigger |
|-------|---------|
| `buffer_started` | `app/api/trip-offers/route.ts` (first auto-match offer) |
| `assignment_confirmed` | `lib/rider/assignment.ts` (finalize buffer) |
| `driver_en_route` | `app/api/rider/notifications/trip-lifecycle` |
| `trip_completed` | same lifecycle API |

Preferences: `rider_notification_preferences` (`email_enabled`, `in_app_enabled`, `sms_enabled`).

SMS requires `profiles.phone` + Twilio env vars. Gracefully skips when not configured.

## Required Supabase migrations (apply in order)

1. Rider portal phase 1 (trips `rider_id`, `trip_source`, matching fields)
2. `rider_auto_match.sql`
3. `rider_notifications.sql`
4. `rider_sms_notifications.sql`
5. `rider_driver_reviews.sql` + `driver_rating_stats_access.sql`
6. `rider_profile_polish.sql` (optional accessibility notes column)

## Environment variables

See `.env.example` — minimum for launch:

- `NEXT_PUBLIC_SUPABASE_*`, `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_APP_URL`
- Optional: `RESEND_API_KEY`, `TWILIO_*`, `CRON_SECRET`

## Extending the portal

### Add a new notification event

1. Add type to `RiderNotificationType` in `lib/rider/notifications.ts`
2. Add copy in `buildNotificationContent()` (title, body, email, SMS)
3. Call `sendRiderNotification()` from the appropriate API route

### Add a new rider page

1. Create under `app/rider/`
2. Use `RiderBackLink`, shared UI tokens, `RiderLoadingSpinner`
3. Add nav item in `components/rider/rider-nav-items.ts` if needed
4. Layout auth guard in `app/rider/layout.tsx` applies automatically

### Manual offer review (Phase 2)

Trips with `matching_mode = 'manual_review'` need a rider UI to compare offers — not yet built.

## Auto-match finalization cron

Vercel **Hobby** allows at most one cron run per day (`vercel.json` uses `0 12 * * *` UTC as a safety net).

The **60-second buffer** is finalized in real time by the rider pending page (client POST when the countdown ends). For sub-minute server-side backup on Pro, change the schedule to `* * * * *` or use an external cron hitting `/api/rider/assignment/finalize` with `Authorization: Bearer $CRON_SECRET`.

## Phase 2 backlog

- Supabase Realtime (trip status, driver location, notifications)
- Policy-tier cancel/refund API (Stripe refunds)
- Manual offer review UI
- Cross-device wizard draft persistence
- Pagination/search on My Trips
- Branded email/SMS templates + delivery webhooks
- Review moderation
- Analytics on Get a Ride funnel

## Pre-launch testing checklist

See conversation report or run through:

1. Sign up as rider → complete wizard → Stripe test payment
2. Driver submits offer → buffer countdown → auto-confirm
3. Decline driver during buffer → trip returns to `open`
4. Driver starts trip → rider sees en route + map poll
5. Complete trip → rate driver
6. Toggle SMS preference with/without phone on profile
7. Cancel Stripe checkout → wizard shows cancelled banner
8. Mobile: sidebar drawer, tab buttons, form touch targets