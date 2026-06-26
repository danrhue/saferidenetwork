/**
 * Modular SMS sender — Twilio when configured, placeholder otherwise.
 * Phase 2: Delivery webhooks; branded templates; cost tracking budgets
 */

export interface SendSmsParams {
  to: string;
  body: string;
}

export interface SendSmsResult {
  sent: boolean;
  provider: string;
  messageId?: string;
}

export interface SmsProvider {
  send(params: SendSmsParams): Promise<SendSmsResult>;
}

/** Normalize a US phone number to E.164 for Twilio (+1XXXXXXXXXX). */
export function normalizePhoneToE164(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (digits.length >= 11 && phone.trim().startsWith('+')) {
    return `+${digits}`;
  }
  return null;
}

function isTwilioConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_PHONE_NUMBER
  );
}

function createTwilioProvider(): SmsProvider {
  const accountSid = process.env.TWILIO_ACCOUNT_SID!;
  const authToken = process.env.TWILIO_AUTH_TOKEN!;
  const from = process.env.TWILIO_PHONE_NUMBER!;

  return {
    async send({ to, body }) {
      const normalized = normalizePhoneToE164(to);
      if (!normalized) {
        console.warn('[SMS] Invalid phone number:', to);
        return { sent: false, provider: 'twilio_invalid_phone' };
      }

      try {
        const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
        const res = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
          {
            method: 'POST',
            headers: {
              Authorization: `Basic ${credentials}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              To: normalized,
              From: from,
              Body: body,
            }),
          }
        );

        const data = (await res.json()) as { sid?: string; message?: string };

        if (!res.ok) {
          console.error('[SMS] Twilio error:', data.message ?? res.statusText);
          return { sent: false, provider: 'twilio_error' };
        }

        return { sent: true, provider: 'twilio', messageId: data.sid };
      } catch (err) {
        console.error('[SMS] Twilio exception:', err);
        return { sent: false, provider: 'twilio_exception' };
      }
    },
  };
}

function createPlaceholderProvider(): SmsProvider {
  return {
    async send({ to, body }) {
      console.log('[SMS placeholder]', { to, preview: body.slice(0, 160) });
      return { sent: false, provider: 'placeholder' };
    },
  };
}

let cachedProvider: SmsProvider | null = null;

function getSmsProvider(): SmsProvider {
  if (!cachedProvider) {
    cachedProvider = isTwilioConfigured() ? createTwilioProvider() : createPlaceholderProvider();
  }
  return cachedProvider;
}

export function isSmsConfigured(): boolean {
  return isTwilioConfigured();
}

export async function sendSMS(params: SendSmsParams): Promise<SendSmsResult> {
  return getSmsProvider().send(params);
}