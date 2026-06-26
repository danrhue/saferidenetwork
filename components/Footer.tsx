import Link from 'next/link';
import Image from 'next/image';

const footerLinkClass =
  'text-sm text-slate-300 hover:text-white transition-colors duration-200';

const footerHeadingClass =
  'mb-3 border-b border-white/15 pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white whitespace-nowrap';

export default function Footer() {
  return (
    <footer className="border-t border-white/10 bg-gradient-to-b from-[#0a1628] via-[#0f2347] to-[#0a1628] text-white">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 py-10 lg:py-11">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-start lg:gap-x-10">
          {/* Brand */}
          <div className="lg:col-span-3">
            <Link
              href="/"
              className="inline-flex rounded-xl bg-white px-4 py-3 shadow-lg shadow-black/25 ring-1 ring-white/20 transition-transform duration-200 hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a1628]"
              aria-label="Safe Ride Network home"
            >
              <Image
                src="/Safe-Ride-Network-Logo.png"
                alt="Safe Ride Network"
                width={320}
                height={80}
                className="h-20 sm:h-24 w-auto max-w-full object-contain"
              />
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-snug text-slate-300">
              A nationwide transportation marketplace connecting organizations and individuals with
              qualified independent drivers. Real-time GPS, geofencing, and tools for reliable rides.
            </p>
          </div>

          {/* Link columns */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-2 md:grid-cols-3 lg:col-span-9 lg:grid-cols-5 lg:gap-x-6 lg:items-start lg:self-start">
            <div className="min-w-0">
              <h3 className={footerHeadingClass}>For Organizations</h3>
              <ul className="space-y-2">
                <li>
                  <Link href="/how-it-works#organizations" className={footerLinkClass}>
                    Post Trips &amp; Find Drivers
                  </Link>
                </li>
                <li>
                  <Link href="/login" className={footerLinkClass}>
                    Organization Portal
                  </Link>
                </li>
                <li>
                  <Link href="/sign-up" className={footerLinkClass}>
                    Sign Up as an Organization
                  </Link>
                </li>
                <li>
                  <Link href="/how-it-works#organizations" className={footerLinkClass}>
                    How Organizations Use It
                  </Link>
                </li>
              </ul>
            </div>

            <div className="min-w-0">
              <h3 className={footerHeadingClass}>For Drivers</h3>
              <ul className="space-y-2">
                <li>
                  <Link href="/apply-to-drive" className={footerLinkClass}>
                    Apply to Drive
                  </Link>
                </li>
                <li>
                  <Link href="/sign-up?role=driver" className={footerLinkClass}>
                    Sign Up as a Driver
                  </Link>
                </li>
                <li>
                  <Link href="/how-it-works#drivers" className={footerLinkClass}>
                    How Drivers Use the Marketplace
                  </Link>
                </li>
                <li>
                  <Link href="/login" className={footerLinkClass}>
                    Driver Portal
                  </Link>
                </li>
              </ul>
            </div>

            <div className="min-w-0">
              <h3 className={footerHeadingClass}>For Riders</h3>
              <ul className="space-y-2">
                <li>
                  <Link href="/get-a-ride" className={footerLinkClass}>
                    Request a Personal Ride
                  </Link>
                </li>
                <li>
                  <Link href="/rider/dashboard" className={footerLinkClass}>
                    Rider Portal
                  </Link>
                </li>
                <li>
                  <Link href="/rider/trips" className={footerLinkClass}>
                    My Trips
                  </Link>
                </li>
                <li>
                  <Link href="/how-it-works#riders" className={footerLinkClass}>
                    How Riders Use It
                  </Link>
                </li>
              </ul>
            </div>

            <div className="min-w-0">
              <h3 className={footerHeadingClass}>Platform</h3>
              <ul className="space-y-2">
                <li>
                  <Link href="/how-it-works" className={footerLinkClass}>
                    How It Works
                  </Link>
                </li>
                <li>
                  <Link href="/get-a-ride" className={footerLinkClass}>
                    Get a Ride
                  </Link>
                </li>
                <li>
                  <Link href="/sign-up" className={footerLinkClass}>
                    Create Account
                  </Link>
                </li>
                <li>
                  <a href="mailto:dispatch@saferidenetwork.com" className={footerLinkClass}>
                    Contact Dispatch
                  </a>
                </li>
                <li>
                  <Link href="/admin/login" className={footerLinkClass}>
                    Admin Login
                  </Link>
                </li>
              </ul>
            </div>

            <div className="min-w-0">
              <h3 className={footerHeadingClass}>Legal</h3>
              <ul className="space-y-2">
                <li>
                  <Link href="/privacy-policy" className={footerLinkClass}>
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link href="/terms-of-service" className={footerLinkClass}>
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <Link href="/copyright" className={footerLinkClass}>
                    Copyright
                  </Link>
                </li>
                <li>
                  <Link href="/faq" className={footerLinkClass}>
                    Legal FAQ
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center gap-2 border-t border-white/10 pt-6 sm:flex-row sm:justify-center sm:gap-4">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white whitespace-nowrap">
            Live Operations Tools
          </span>
          <span className="hidden h-4 w-px bg-white/20 sm:block" aria-hidden="true" />
          <p className="text-center text-sm text-slate-300 sm:text-left">
            Real-time GPS • Geofencing Alerts • Trip Trails • Ratings &amp; Reviews
          </p>
        </div>
      </div>

      <div className="border-t border-white/10 bg-black/25">
        <div className="max-w-7xl mx-auto flex flex-col items-center gap-3 px-6 py-3.5 text-xs text-slate-400 sm:px-8 md:flex-row md:justify-between">
          <div className="text-center md:text-left md:max-w-[40%]">
            © {new Date().getFullYear()} Safe Ride Network, a product of Shining Light Capital LLC. All rights reserved.
          </div>
          <nav
            className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-slate-400"
            aria-label="Legal"
          >
            <Link href="/privacy-policy" className="hover:text-white transition-colors">
              Privacy
            </Link>
            <span className="text-slate-600" aria-hidden="true">·</span>
            <Link href="/terms-of-service" className="hover:text-white transition-colors">
              Terms
            </Link>
            <span className="text-slate-600" aria-hidden="true">·</span>
            <Link href="/copyright" className="hover:text-white transition-colors">
              Copyright
            </Link>
            <span className="text-slate-600" aria-hidden="true">·</span>
            <Link href="/faq" className="hover:text-white transition-colors">
              FAQ
            </Link>
          </nav>
          <div className="text-center text-slate-500 md:text-right md:max-w-[30%]">
            Organizations • Drivers • Riders • Secure Operations Platform
          </div>
        </div>
      </div>
    </footer>
  );
}