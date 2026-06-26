import Link from 'next/link';
import Navbar from '@/app/components/Navbar';

interface LegalPageLayoutProps {
  title: string;
  subtitle: string;
  effectiveDate?: string;
  lastUpdated?: string;
  showLegalNotice?: boolean;
  children: React.ReactNode;
}

const legalNav = [
  { href: '/privacy-policy', label: 'Privacy Policy' },
  { href: '/terms-of-service', label: 'Terms of Service' },
  { href: '/copyright', label: 'Copyright' },
  { href: '/faq', label: 'Legal FAQ' },
];

export default function LegalPageLayout({
  title,
  subtitle,
  effectiveDate,
  lastUpdated,
  showLegalNotice = false,
  children,
}: LegalPageLayoutProps) {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      <section className="bg-blue-950 text-white py-14 md:py-16">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="inline px-3 py-1 text-xs tracking-[2px] bg-white/10 rounded-full border border-white/20 mb-4">
            SHINING LIGHT CAPITAL LLC
          </div>
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tighter mb-4">{title}</h1>
          <p className="max-w-2xl mx-auto text-lg text-blue-100">{subtitle}</p>
          {(effectiveDate || lastUpdated) && (
            <div className="mt-5 text-sm text-blue-200">
              {effectiveDate && <span>Effective: {effectiveDate}</span>}
              {effectiveDate && lastUpdated && <span className="mx-2">•</span>}
              {lastUpdated && <span>Last Updated: {lastUpdated}</span>}
            </div>
          )}
        </div>
      </section>

      <div className="border-b bg-blue-50">
        <div className="max-w-4xl mx-auto px-6 py-3 flex flex-wrap justify-center gap-2 text-sm">
          {legalNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="px-3 py-1.5 rounded-lg border border-blue-200 bg-white text-blue-950 hover:bg-blue-100 transition font-medium"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>

      <article className="max-w-4xl mx-auto px-6 py-12 md:py-16">
        {showLegalNotice && (
          <div className="mb-10 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-relaxed text-amber-950">
            <strong className="font-semibold">Important:</strong> This document is provided for
            informational purposes and does not constitute legal advice. Shining Light Capital LLC
            recommends review by qualified legal counsel before reliance, especially regarding
            liability, independent contractor classification, location data, and sector-specific
            requirements (schools, healthcare, NEMT).
          </div>
        )}

        <div className="legal-prose">{children}</div>

        <div className="mt-12 pt-8 border-t border-blue-100 text-sm text-blue-800">
          <p className="font-semibold text-blue-950 mb-2">Questions?</p>
          <p>
            Contact{' '}
            <a href="mailto:dispatch@saferidenetwork.com" className="text-[#1E3A8A] hover:underline font-medium">
              dispatch@saferidenetwork.com
            </a>
          </p>
          <p className="mt-4 text-blue-700">
            Safe Ride Network is a product of Shining Light Capital LLC.
          </p>
        </div>
      </article>
    </div>
  );
}