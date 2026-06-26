'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import DriverEarningsPanel from '@/components/driver/DriverEarningsPanel';
import DriverStripeConnectPanel from '@/components/driver/DriverStripeConnectPanel';
import { authFetch } from '@/lib/auth-fetch';
import { supabase } from '@/lib/supabase';

const PAYMENTS_RETURN_PATH = '/dashboard/payments';

export default function DriverPaymentsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [stripeConnecting, setStripeConnecting] = useState(false);
  const [stripeMessage, setStripeMessage] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get('stripe') === 'complete') {
      setStripeMessage('Stripe onboarding submitted. Status will update shortly.');
      router.replace(PAYMENTS_RETURN_PATH, { scroll: false });
    } else if (searchParams.get('stripe') === 'refresh') {
      setStripeMessage('Please complete your Stripe setup to receive trip payouts.');
      router.replace(PAYMENTS_RETURN_PATH, { scroll: false });
    }
  }, [router, searchParams]);

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: prof } = await supabase
        .from('profiles')
        .select(
          'role, stripe_account_id, stripe_onboarding_complete, stripe_payouts_enabled'
        )
        .eq('id', user.id)
        .single();

      setProfile(prof ?? null);
      setLoading(false);
    };

    void load();
  }, [router]);

  const handleConnectStripe = useCallback(async () => {
    setStripeConnecting(true);
    setStripeMessage(null);
    try {
      const createRes = await authFetch('/api/stripe/connect/create-account', { method: 'POST' });
      const createData = await createRes.json();
      if (!createRes.ok) throw new Error(createData.error || 'Failed to create Stripe account');

      const linkRes = await authFetch('/api/stripe/connect/account-link', {
        method: 'POST',
        body: JSON.stringify({ returnPath: PAYMENTS_RETURN_PATH }),
      });
      const linkData = await linkRes.json();
      if (!linkRes.ok) throw new Error(linkData.error || 'Failed to generate onboarding link');

      if (linkData.url) {
        window.location.href = linkData.url;
        return;
      }
      throw new Error('No onboarding URL returned');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Stripe connection failed';
      setStripeMessage(msg);
    } finally {
      setStripeConnecting(false);
    }
  }, []);

  if (loading) {
    return <div className="p-8 text-blue-950">Loading payments...</div>;
  }

  if (profile?.role === 'organization') {
    return (
      <div className="max-w-3xl">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Payments</h1>
        <p className="text-gray-600">Stripe Connect is only available for driver accounts.</p>
      </div>
    );
  }

  const isStripeConnected =
    profile?.stripe_account_id &&
    profile?.stripe_onboarding_complete &&
    profile?.stripe_payouts_enabled;

  return (
    <div className="mx-auto max-w-5xl pb-12">
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold text-blue-950">Payments & Earnings</h1>
        <p className="text-gray-600">
          View your balance, pending payouts, completed earnings, and active trip compensation.
          Connect Stripe below to receive payouts to your bank.
        </p>
      </div>

      <div className="space-y-8">
        <section>
          <h2 className="mb-4 text-lg font-semibold text-blue-950">Payments Dashboard</h2>
          <DriverEarningsPanel />
        </section>

        <section>
          <h2 className="mb-4 text-lg font-semibold text-blue-950">Payout Account</h2>
          <DriverStripeConnectPanel
            isStripeConnected={!!isStripeConnected}
            hasStripeAccount={!!profile?.stripe_account_id}
            stripeConnecting={stripeConnecting}
            stripeMessage={stripeMessage}
            onConnectStripe={() => void handleConnectStripe()}
          />
        </section>
      </div>
    </div>
  );
}