import { authFetch } from '@/lib/auth-fetch';

export interface ConfirmRiderPaymentDebug {
  tripId?: string;
  sessionId?: string;
  stripeMode?: string;
  reason?: string;
  updateError?: string;
  elapsedMs?: number;
}

export interface ConfirmRiderPaymentResult {
  paid: boolean;
  alreadyPaid: boolean;
  updated?: boolean;
  sessionPaymentStatus?: string | null;
  sessionStatus?: string | null;
  paymentIntentStatus?: string | null;
  error?: string;
  debug?: ConfirmRiderPaymentDebug;
}

/** Ask the server to verify Stripe checkout and mark the trip paid (webhook fallback). */
export async function confirmRiderTripPayment(
  tripId: string,
  sessionId?: string | null
): Promise<ConfirmRiderPaymentResult> {
  const response = await authFetch('/api/rider/confirm-payment', {
    method: 'POST',
    body: JSON.stringify({
      tripId,
      ...(sessionId ? { sessionId } : {}),
    }),
  });

  const data = await response.json();

  if (!response.ok && !data.paid) {
    const detail = data.debug?.reason || data.debug?.updateError;
    throw new Error(
      detail ? `${data.error || 'Failed to confirm payment'} (${detail})` : data.error || 'Failed to confirm payment'
    );
  }

  return {
    paid: Boolean(data.paid),
    alreadyPaid: Boolean(data.alreadyPaid),
    updated: Boolean(data.updated),
    sessionPaymentStatus: data.sessionPaymentStatus ?? null,
    sessionStatus: data.sessionStatus ?? null,
    paymentIntentStatus: data.paymentIntentStatus ?? null,
    error: data.error,
    debug: data.debug,
  };
}

/** Start or resume Stripe Checkout for an existing rider trip. */
export async function startRiderTripCheckout(tripId: string): Promise<string> {
  const response = await authFetch('/api/rider/create-checkout-session', {
    method: 'POST',
    body: JSON.stringify({ tripId }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to start checkout');
  }

  if (!data.url) {
    throw new Error('Stripe did not return a checkout URL.');
  }

  return data.url;
}

/** True when the rider still needs to pay before the trip is published to drivers. */
export function riderTripNeedsPayment(
  paymentStatus: string | null | undefined,
  tripStatus: string
): boolean {
  if (tripStatus === 'cancelled') return false;
  return paymentStatus !== 'paid';
}