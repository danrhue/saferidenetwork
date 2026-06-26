import Stripe from 'stripe';

// ---------------------------------------------------------------------------
// Stripe Connect client — Safe Ride Network marketplace
// Architecture: Express accounts for drivers + Destination Charges for payouts
// ---------------------------------------------------------------------------

const STRIPE_API_VERSION: Stripe.LatestApiVersion = '2023-10-16';

let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeInstance) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }
    stripeInstance = new Stripe(key, {
      apiVersion: STRIPE_API_VERSION,
      typescript: true,
    });
  }
  return stripeInstance;
}

export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'http://localhost:3000';

export type ChargeType =
  | 'driver_compensation' // Org pays driver comp at posting — held on platform
  | 'platform_fee' // Org pays platform fee at trip completion
  | 'destination_payout' // Combined payout via Destination Charge (driver assigned)
  | 'rider_trip_payment'; // Rider pays upfront (driver comp + platform fee)

export interface MarketplaceCheckoutParams {
  tripId: string;
  title: string;
  /** Total amount charged to the organization (in cents) */
  amountCents: number;
  chargeType: ChargeType;
  organizationId: string;
  /** Connected Express account — required for destination_payout */
  driverStripeAccountId?: string;
  /** Platform fee retained by Safe Ride Network (cents) — used with destination charges */
  platformFeeCents?: number;
  /** Amount transferred to driver (cents) — used with destination charges */
  driverPayoutCents?: number;
}

function lineItemName(chargeType: ChargeType, title: string): string {
  switch (chargeType) {
    case 'driver_compensation':
      return `Driver Compensation — ${title}`;
    case 'platform_fee':
      return `Platform Fee — ${title}`;
    case 'destination_payout':
      return `Trip Payment — ${title}`;
    case 'rider_trip_payment':
      return `Ride Request — ${title}`;
    default:
      return title;
  }
}

function lineItemDescription(chargeType: ChargeType): string {
  switch (chargeType) {
    case 'driver_compensation':
      return 'Driver compensation held securely until trip completion (Safe Ride Network)';
    case 'platform_fee':
      return 'Safe Ride Network platform service fee (15% of driver compensation)';
    case 'destination_payout':
      return 'Trip payment — driver payout + platform fee via Stripe Connect';
    case 'rider_trip_payment':
      return 'Personal ride request — driver compensation + platform fee (Safe Ride Network)';
    default:
      return 'Safe Ride Network trip payment';
  }
}

/**
 * Creates a Stripe Checkout session for marketplace payments.
 *
 * Fund flows:
 * - driver_compensation: Standard charge to platform account (no driver assigned yet).
 *   Funds are transferred to the driver's Express account when the trip completes.
 * - platform_fee: Direct charge to platform account at trip completion.
 * - destination_payout: Destination Charge — org pays total, platform keeps application_fee,
 *   remainder auto-transfers to the driver's connected Express account.
 */
export async function createMarketplaceCheckoutSession(
  params: MarketplaceCheckoutParams
): Promise<Stripe.Checkout.Session> {
  const stripe = getStripe();
  const {
    tripId,
    title,
    amountCents,
    chargeType,
    organizationId,
    driverStripeAccountId,
    platformFeeCents = 0,
    driverPayoutCents,
  } = params;

  if (amountCents <= 0) {
    throw new Error('Payment amount must be greater than zero');
  }

  const metadata: Record<string, string> = {
    tripId,
    chargeType,
    organizationId,
  };

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    payment_method_types: ['card'],
    mode: 'payment',
    metadata,
    success_url: `${APP_URL}/organization/trips?success=true&tripId=${tripId}&chargeType=${chargeType}`,
    cancel_url: `${APP_URL}/organization/trips?cancelled=true&tripId=${tripId}`,
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: lineItemName(chargeType, title),
            description: lineItemDescription(chargeType),
          },
          unit_amount: amountCents,
        },
        quantity: 1,
      },
    ],
  };

  // Destination Charge — primary Connect fund flow when driver is known
  if (chargeType === 'destination_payout') {
    if (!driverStripeAccountId) {
      throw new Error('Driver Stripe account required for destination payout');
    }
    if (!driverPayoutCents || driverPayoutCents <= 0) {
      throw new Error('Driver payout amount must be greater than zero');
    }

    sessionParams.payment_intent_data = {
      application_fee_amount: platformFeeCents,
      transfer_data: { destination: driverStripeAccountId },
      metadata: { ...metadata, driverPayoutCents: String(driverPayoutCents) },
    };
  } else if (chargeType === 'driver_compensation') {
    // Hold funds on platform; transfer to driver Express account on completion
    sessionParams.payment_intent_data = {
      metadata: { ...metadata, held_for_transfer: 'true' },
    };
  } else {
    // platform_fee — stays on platform account
    sessionParams.payment_intent_data = { metadata };
  }

  return stripe.checkout.sessions.create(sessionParams);
}

export interface RiderCheckoutParams {
  tripId: string;
  title: string;
  /** Total charged to rider (driver comp + platform fee) in cents */
  amountCents: number;
  riderId: string;
  /** Override cancel URL (e.g. resume payment from trip detail) */
  cancelUrl?: string;
}

/**
 * Stripe Checkout for Rider Portal trip requests.
 * Rider pays the full trip total upfront; funds are held on platform until completion.
 */
export async function createRiderCheckoutSession(
  params: RiderCheckoutParams
): Promise<Stripe.Checkout.Session> {
  const stripe = getStripe();
  const { tripId, title, amountCents, riderId, cancelUrl } = params;

  if (amountCents <= 0) {
    throw new Error('Payment amount must be greater than zero');
  }

  // Snake_case keys are read by the webhook; camelCase kept for backward compatibility.
  const metadata: Record<string, string> = {
    trip_id: tripId,
    trip_source: 'rider',
    user_id: riderId,
    charge_type: 'rider_trip_payment',
    tripId,
    tripSource: 'rider',
    riderId,
    chargeType: 'rider_trip_payment',
  };

  return stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'payment',
    metadata,
    success_url: `${APP_URL}/rider/trips/${tripId}?success=true&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl ?? `${APP_URL}/rider/trips/new?cancelled=true&tripId=${tripId}`,
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: lineItemName('rider_trip_payment', title),
            description: lineItemDescription('rider_trip_payment'),
          },
          unit_amount: amountCents,
        },
        quantity: 1,
      },
    ],
    payment_intent_data: {
      metadata: { ...metadata, held_for_transfer: 'true' },
    },
  });
}

/**
 * Creates a Stripe Express connected account for a driver.
 * Express is recommended for gig/driver marketplaces — Stripe handles onboarding UI.
 */
export async function createDriverExpressAccount(
  email: string,
  userId: string
): Promise<Stripe.Account> {
  const stripe = getStripe();

  return stripe.accounts.create({
    type: 'express',
    email,
    country: 'US',
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    business_type: 'individual',
    metadata: { supabase_user_id: userId },
  });
}

/**
 * Generates a Stripe Account Link for Express onboarding or refresh.
 */
export async function createDriverAccountLink(
  accountId: string,
  returnPath = '/dashboard/profile'
): Promise<Stripe.AccountLink> {
  const stripe = getStripe();

  return stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${APP_URL}${returnPath}?stripe=refresh`,
    return_url: `${APP_URL}${returnPath}?stripe=complete`,
    type: 'account_onboarding',
  });
}

/**
 * Transfers held driver compensation to a connected Express account.
 * Links to the original charge via source_transaction for clean accounting.
 */
export async function transferDriverPayout(params: {
  amountCents: number;
  driverStripeAccountId: string;
  tripId: string;
  sourcePaymentIntentId: string;
}): Promise<Stripe.Transfer> {
  const stripe = getStripe();
  const { amountCents, driverStripeAccountId, tripId, sourcePaymentIntentId } = params;

  const paymentIntent = await stripe.paymentIntents.retrieve(sourcePaymentIntentId);
  const chargeId =
    typeof paymentIntent.latest_charge === 'string'
      ? paymentIntent.latest_charge
      : paymentIntent.latest_charge?.id;

  if (!chargeId) {
    throw new Error('No charge found on the source payment — cannot create transfer');
  }

  return stripe.transfers.create({
    amount: amountCents,
    currency: 'usd',
    destination: driverStripeAccountId,
    source_transaction: chargeId,
    transfer_group: tripId,
    metadata: { tripId, type: 'driver_compensation_payout' },
  });
}

/**
 * Syncs Connect account capabilities back to our profile fields.
 */
export function getConnectAccountStatus(account: Stripe.Account): {
  onboardingComplete: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
} {
  return {
    onboardingComplete: account.details_submitted ?? false,
    chargesEnabled: account.charges_enabled ?? false,
    payoutsEnabled: account.payouts_enabled ?? false,
  };
}

/** Convert dollar amounts to Stripe cents (integer). */
export function dollarsToCents(amount: number): number {
  return Math.round(amount * 100);
}