# Safe Ride Network

A national professional transportation marketplace connecting organizations with qualified drivers. Built with Next.js, Supabase, Stripe Connect, and Google Maps.

## Features

- **Organization portal** — post trips, review driver offers, live GPS tracking
- **Driver portal** — browse trips, submit offers, trip execution, Stripe Connect payouts
- **Admin dashboard** — document review, live trip monitoring, pricing configuration
- **Stripe Connect** — Express accounts for drivers, destination charges, platform fees

## Getting Started (Local)

1. Clone the repository and install dependencies:

```bash
npm install
```

2. Copy environment variables:

```bash
copy .env.example .env.local
```

3. Fill in `.env.local` with your Supabase, Stripe (test keys), and Google Maps credentials.

4. Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deployment Checklist

Use this before every production release. Full details are in **[DEPLOYMENT.md](./DEPLOYMENT.md)**.

- [ ] **Supabase** — Run latest migrations from `supabase/schema.sql`
- [ ] **Vercel env vars** — All required variables set (see `.env.example`)
- [ ] **`NEXT_PUBLIC_APP_URL`** — Set to `https://www.saferidenetwork.com` (no trailing slash)
- [ ] **`SUPABASE_SERVICE_ROLE_KEY`** — Set in Vercel (server-only, never in browser)
- [ ] **`STRIPE_SECRET_KEY`** — Production key (`sk_live_...`) when going live
- [ ] **Deploy** — `.\deploy.ps1` or `npx vercel --prod --yes`
- [ ] **Stripe webhook** — Endpoint: `https://www.saferidenetwork.com/api/stripe/webhook`
- [ ] **`STRIPE_WEBHOOK_SECRET`** — Added to Vercel after webhook is created
- [ ] **Redeploy** — After adding webhook secret
- [ ] **Stripe Connect** — Express accounts enabled; test driver onboarding
- [ ] **Google Maps** — API key restricted to production domain referrers
- [ ] **Smoke test** — Post trip → pay → assign driver → complete → verify payout in Stripe

## Deploy Command (Windows)

```powershell
.\deploy.ps1
```

## Environment Variables

See **[`.env.example`](./.env.example)** for the complete list with descriptions.

## Project Structure

```
app/
  admin/          # Admin dashboard, documents, pricing, live trips
  api/stripe/     # Stripe Connect + Checkout + webhook
  dashboard/      # Driver portal
  organization/   # Organization portal
lib/
  stripe.ts       # Stripe Connect client
  pricing.ts      # Trip pricing engine
supabase/
  schema.sql      # Database schema + RLS policies
```

## Documentation

- [DEPLOYMENT.md](./DEPLOYMENT.md) — Vercel, Stripe webhook, and Connect setup
- [.env.example](./.env.example) — All environment variables

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Stripe Connect — Destination Charges](https://docs.stripe.com/connect/destination-charges)
- [Supabase Documentation](https://supabase.com/docs)