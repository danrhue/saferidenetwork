import { APP_URL } from '@/lib/stripe';

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Modular email sender — uses Resend when RESEND_API_KEY is set.
 * TODO: Replace placeholder with branded HTML templates per notification type.
 */
export async function sendEmail(params: SendEmailParams): Promise<{ sent: boolean; provider: string }> {
  const { to, subject, html, text } = params;
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || 'Safe Ride Network <notifications@saferidenetwork.com>';

  if (!apiKey) {
    console.log('[Email placeholder]', { to, subject, preview: text ?? html.slice(0, 120) });
    return { sent: false, provider: 'placeholder' };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        html,
        text: text ?? html.replace(/<[^>]+>/g, ''),
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('Resend email failed:', err);
      return { sent: false, provider: 'resend_error' };
    }

    return { sent: true, provider: 'resend' };
  } catch (err) {
    console.error('Email send error:', err);
    return { sent: false, provider: 'resend_exception' };
  }
}

export function emailButton(href: string, label: string): string {
  const url = href.startsWith('http') ? href : `${APP_URL}${href}`;
  return `<p style="margin:24px 0;"><a href="${url}" style="background:#1E3A8A;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">${label}</a></p>`;
}

export function emailLayout(title: string, bodyHtml: string, ctaHref?: string, ctaLabel?: string): string {
  const cta = ctaHref && ctaLabel ? emailButton(ctaHref, ctaLabel) : '';
  return `
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;color:#1e3a8a;">
      <h1 style="font-size:20px;margin-bottom:16px;">${title}</h1>
      <div style="color:#1e40af;line-height:1.6;">${bodyHtml}</div>
      ${cta}
      <p style="margin-top:32px;font-size:12px;color:#64748b;">Safe Ride Network • Shining Light Capital LLC</p>
    </div>
  `;
}