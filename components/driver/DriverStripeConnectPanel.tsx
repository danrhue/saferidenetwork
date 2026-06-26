'use client';

type DriverStripeConnectPanelProps = {
  isStripeConnected: boolean;
  hasStripeAccount: boolean;
  stripeConnecting: boolean;
  stripeMessage: string | null;
  onConnectStripe: () => void;
};

export default function DriverStripeConnectPanel({
  isStripeConnected,
  hasStripeAccount,
  stripeConnecting,
  stripeMessage,
  onConnectStripe,
}: DriverStripeConnectPanelProps) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 md:p-10">
      <div className="mb-6 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
        <strong>Optional but recommended.</strong> You can complete your driver profile without
        Stripe. Connect when you are ready to receive payouts for completed trips.
      </div>

      <div className="text-center py-4">
        <h2 className="text-2xl font-semibold text-blue-950 mb-2">Stripe Connect Payouts</h2>
        <p className="text-gray-600 max-w-lg mx-auto">
          Connect your Stripe Express account so you can get paid automatically when an organization
          marks a trip as complete.
        </p>

        {isStripeConnected ? (
          <div className="max-w-md mx-auto flex flex-col items-center gap-3 p-6 bg-green-50 border border-green-200 rounded-2xl mt-8">
            <span className="text-green-700 font-semibold text-lg">Stripe Connected</span>
            <span className="text-sm text-green-600">Ready to receive payouts</span>
          </div>
        ) : hasStripeAccount ? (
          <div className="max-w-md mx-auto space-y-4 mt-8">
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm">
              Stripe account created — complete onboarding to enable payouts.
            </div>
            <button
              type="button"
              onClick={onConnectStripe}
              disabled={stripeConnecting}
              className="bg-[#1E3A8A] text-white px-10 py-4 rounded-2xl hover:bg-[#162d6b] disabled:opacity-60 min-h-[48px]"
            >
              {stripeConnecting ? 'Loading...' : 'Complete Stripe Setup'}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onConnectStripe}
            disabled={stripeConnecting}
            className="mt-8 bg-[#1E3A8A] text-white px-10 py-4 rounded-2xl hover:bg-[#162d6b] disabled:opacity-60 min-h-[48px]"
          >
            {stripeConnecting ? 'Connecting...' : 'Connect with Stripe'}
          </button>
        )}

        <p className="text-xs text-gray-500 mt-6">
          Secure • Fast payouts • No fees from Safe Ride Network
        </p>
        {stripeMessage && (
          <p className="text-sm text-blue-800 mt-4" role="status">
            {stripeMessage}
          </p>
        )}
      </div>
    </div>
  );
}