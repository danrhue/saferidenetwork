/** Compact trust signal shown on key rider flows (dashboard, checkout). */
export default function RiderTrustBanner({ className = '' }: { className?: string }) {
  return (
    <p
      className={`rounded-xl border border-blue-100 bg-blue-50/80 px-4 py-3 text-xs leading-relaxed text-blue-800 ${className}`.trim()}
    >
      <span className="font-semibold text-blue-950">Safe Ride Network</span> — vetted drivers,
      transparent pricing, and secure Stripe payments. Need help?{' '}
      <a href="mailto:dispatch@saferidenetwork.com" className="font-medium text-[#1E3A8A] hover:underline">
        Contact dispatch
      </a>
    </p>
  );
}