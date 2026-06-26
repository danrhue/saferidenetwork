# Safe Ride Network — Deployment Guide

Production deployment checklist for Vercel, Supabase, Stripe (including Connect), and Google Maps.

---

## Recommended Order of Operations

Complete these steps in order. Skipping ahead (especially the webhook) will break payments.

| Step | Task | Where |
|------|------|-------|
| 1 | Run Supabase schema migrations | Supabase SQL Editor |
| 2 | Add environment variables in Vercel | Vercel Dashboard |
| 3 | Deploy to production | Terminal / `deploy.ps1` |
| 4 | Create Stripe webhook (production URL) | Stripe Dashboard |
| 5 | Add `STRIPE_WEBHOOK_SECRET` to Vercel | Vercel Dashboard |
| 6 | Redeploy (or trigger redeploy) | Terminal / `deploy.ps1` |
| 7 | Enable Stripe Connect + test flows | Stripe Dashboard + live site |

---

## Step 1 — Supabase Schema

Before deploying, ensure your production database has the latest schema.

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project → **SQL Editor**.
2. Run the migration blocks from `supabase/schema.sql`, especially:
   - Stripe Connect columns on `profiles` (`stripe_account_id`, etc.)
   - Trip payment columns on `trips` (`stripe_transfer_id`, `driver_payout_status`, etc.)
   - `pricing_settings` table (if not already created)
3. Confirm storage buckets exist: `driver-documents`, `driver-photos`, `organization-logos`.
4. Copy your **service role key** (Project Settings → API) — you will need it in Vercel.

---

## Step 2 — Vercel Environment Variables

1. Go to [Vercel Dashboard](https://vercel.com) → your project → **Settings** → **Environment Variables**.
2. Add each variable below for **Production** (and Preview/Development if you use those environments).
3. Use values from your `.env.local` or provider dashboards — never paste placeholders.

See `.env.example` for the full list with comments.

### Required variables

| Variable | Exposed to browser? | Notes |
|----------|---------------------|-------|
| `NEXT_PUBLIC_APP_URL` | Yes | `https://www.saferidenetwork.com` (no trailing slash) |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | **No** | Server-only; required for webhooks |
| `STRIPE_SECRET_KEY` | **No** | `sk_live_...` in production |
| `STRIPE_WEBHOOK_SECRET` | **No** | Add after Step 4 (`whsec_...`) |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Yes | Restrict by HTTP referrer in Google Cloud |

### Optional variables

| Variable | Notes |
|----------|-------|
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | For future client-side Stripe.js |
| `GOOGLE_MAPS_API_KEY` | Server-side fallback for distance API |
| `NEXT_PUBLIC_PHONE_NUMBER` | Site display (optional) |
| `NEXT_PUBLIC_EMAIL` | Site display (optional) |
| `NEXT_PUBLIC_LOCATION` | Site display (optional) |

**Tip:** Add every variable except `STRIPE_WEBHOOK_SECRET` before the first deploy. Add the webhook secret after Step 4, then redeploy.

---

## Step 3 — Deploy to Vercel

### Option A — Deployment script (Windows)

From PowerShell, in the project root:

```powershell
.\deploy.ps1
```

### Option B — Manual command

```powershell
cd "C:\Users\Dan Rhue\saferidenetwork"
npx vercel --prod --yes
```

### Option C — Git push (if connected to Vercel)

Push to your main branch; Vercel auto-deploys if the repo is linked.

After deploy, confirm the production URL loads: `https://www.saferidenetwork.com`

---

## Step 4 — Stripe Webhook Setup

You need the **live production URL** from Step 3 before creating the webhook.

1. Open [Stripe Dashboard](https://dashboard.stripe.com) → **Developers** → **Webhooks**.
2. Click **Add endpoint**.
3. **Endpoint URL:**
   ```
   https://www.saferidenetwork.com/api/stripe/webhook
   ```
   (Replace with your actual production domain if different.)
4. **Select events to listen to:**
   - `checkout.session.completed`
   - `account.updated`
   - `transfer.created`
   - `payout.paid`
   - `payment_intent.payment_failed`
5. Click **Add endpoint**.
6. Open the new endpoint → **Signing secret** → **Reveal** → copy the `whsec_...` value.

---

## Step 5 — Add Webhook Secret to Vercel

1. Vercel → Project → **Settings** → **Environment Variables**.
2. Add:
   - **Name:** `STRIPE_WEBHOOK_SECRET`
   - **Value:** `whsec_...` (from Step 4)
   - **Environment:** Production (and Preview if you test previews with Stripe)
3. Save.

---

## Step 6 — Redeploy

Environment variables only apply to new deployments. Redeploy after adding `STRIPE_WEBHOOK_SECRET`:

```powershell
.\deploy.ps1
```

Or in Vercel → **Deployments** → latest deployment → **Redeploy**.

---

## Step 7 — Stripe Connect Setup

1. Stripe Dashboard → **Connect** → complete platform onboarding if prompted.
2. Choose **Express** accounts for drivers (recommended for gig/driver marketplaces).
3. In **Connect settings**, set branding and redirect URLs if required.
4. Return URLs are built from `NEXT_PUBLIC_APP_URL` + `/dashboard/profile`.

### Test the full payment flow (test mode first)

1. Use `sk_test_...` and test webhook endpoint (or Stripe CLI locally).
2. Log in as a **driver** → **Profile** → **Connect with Stripe** → complete Express onboarding.
3. Log in as an **organization** → **Post a New Trip** → pay with test card `4242 4242 4242 4242`.
4. Assign the connected driver → **Mark complete** → verify platform fee charge and driver transfer in Stripe Dashboard.

---

## Google Maps API Restrictions (Production)

In [Google Cloud Console](https://console.cloud.google.com) → Credentials → your API key:

1. **Application restrictions:** HTTP referrers
2. Add:
   - `https://www.saferidenetwork.com/*`
   - `https://saferidenetwork.com/*`
   - `http://localhost:3000/*` (for local dev)
3. **API restrictions:** Maps JavaScript API, Places API, Directions API, Geocoding API, Distance Matrix API

---

## Local Webhook Testing (Optional)

Use Stripe CLI to forward events to your local server before production webhook setup:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Copy the displayed `whsec_...` into `.env.local` as `STRIPE_WEBHOOK_SECRET`, then run `npm run dev`.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Checkout redirects to wrong URL | `NEXT_PUBLIC_APP_URL` missing or wrong | Set in Vercel, redeploy |
| Webhook returns 400 | Wrong `STRIPE_WEBHOOK_SECRET` | Re-copy signing secret from Stripe endpoint |
| Driver payout fails | Driver not onboarded on Connect | Driver completes Stripe setup in Profile |
| Maps "API key not configured" | Missing Google key in Vercel | Add `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` |
| Trip insert errors | Schema out of date | Re-run `supabase/schema.sql` migrations |
| `RefererNotAllowedMapError` | Google key referrer restrictions | Add production domain to allowed referrers |

---

## Quick Reference — Deploy Command

```powershell
npx vercel --prod --yes
```

Or:

```powershell
.\deploy.ps1
```