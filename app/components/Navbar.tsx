'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactElement } from 'react';
import { supabase } from '@/lib/supabase';
import {
  PUBLIC_NAV_LINKS,
  PORTAL_CONFIG,
  portalHref,
  isPortalActive,
  type PortalRole,
} from '@/components/public/portal-nav';

/* ── Shared utility classes ── */

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A8A] focus-visible:ring-offset-2';

/** Compact at lg (1024), relaxed at xl (1280), full at 2xl (1536) */
const portalBaseClass = [
  'inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-lg font-semibold transition-all duration-200 active:scale-[0.98]',
  'min-h-9 gap-0.5 px-1.5 py-1.5 text-[10px] leading-none tracking-tight',
  'lg:min-h-9 lg:rounded-lg lg:px-2 lg:text-[11px]',
  'xl:min-h-[40px] xl:gap-1 xl:rounded-xl xl:px-2.5 xl:py-2 xl:text-xs',
  '2xl:min-h-[44px] 2xl:gap-1.5 2xl:px-3 2xl:py-2.5 2xl:text-sm',
  focusRing,
].join(' ');

const portalStyles: Record<PortalRole, { default: string; active: string }> = {
  organization: {
    default:
      'border border-[#1E3A8A] bg-white text-[#1E3A8A] shadow-sm hover:border-[#1E40AF] hover:bg-blue-50 hover:shadow-md xl:border-2',
    active:
      'border border-[#1E3A8A] bg-[#1E3A8A] text-white shadow-md ring-2 ring-blue-200 xl:border-2',
  },
  driver: {
    default:
      'bg-gradient-to-b from-[#2563EB] to-[#1E3A8A] text-white shadow-sm hover:from-[#3B82F6] hover:to-[#1E40AF] hover:shadow-md xl:shadow-md',
    active:
      'bg-gradient-to-b from-[#1D4ED8] to-[#172554] text-white shadow-md ring-2 ring-blue-300',
  },
  rider: {
    default:
      'border border-blue-300 bg-gradient-to-b from-blue-50 to-white text-[#1E3A8A] shadow-sm hover:border-[#1E3A8A] hover:from-blue-100 hover:shadow-md xl:border-2',
    active:
      'border border-[#1E3A8A] bg-gradient-to-b from-[#3B82F6] to-[#1E3A8A] text-white shadow-md ring-2 ring-blue-200 xl:border-2',
  },
};

const signUpClass = [
  'inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-lg border border-blue-200 bg-blue-950 font-semibold text-white transition-all duration-200 hover:bg-blue-900 active:scale-[0.98]',
  'min-h-9 px-2.5 py-2 text-[11px] leading-none',
  'xl:min-h-[40px] xl:rounded-xl xl:px-3 xl:py-2.5 xl:text-xs',
  '2xl:min-h-[44px] 2xl:px-4 2xl:text-sm',
  focusRing,
].join(' ');

const getARideCtaClass = [
  'inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-lg bg-[#1E3A8A] font-semibold text-white shadow-sm transition hover:bg-[#172554]',
  'min-h-9 px-2.5 py-2 text-[11px] leading-none',
  'xl:min-h-[40px] xl:rounded-xl xl:px-3 xl:py-2.5 xl:text-xs',
  '2xl:min-h-[44px] 2xl:px-4 2xl:text-sm',
  focusRing,
].join(' ');

const navLinkClass = [
  'shrink-0 whitespace-nowrap font-medium transition-colors',
  'text-[11px] leading-none tracking-tight',
  'xl:text-xs',
  '2xl:text-sm',
].join(' ');

const DESKTOP_MIN_WIDTH = 1024;

/* ── Icons ── */

function BuildingIcon({ className = 'h-3 w-3 xl:h-3.5 xl:w-3.5 2xl:h-4 2xl:w-4' }: { className?: string } = {}) {
  return (
    <svg className={`${className} shrink-0 opacity-90`} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  );
}

function WheelIcon({ className = 'h-3 w-3 xl:h-3.5 xl:w-3.5 2xl:h-4 2xl:w-4' }: { className?: string } = {}) {
  return (
    <svg className={`${className} shrink-0 opacity-90`} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2a10 10 0 100 20 10 10 0 000-20zm0 4v2m0 8v2m8-6h-2M6 12H4m13.07-5.07l-1.41 1.41M7.34 16.66l-1.41 1.41m0-11.32l1.41 1.41m9.9 9.9l1.41 1.41" />
    </svg>
  );
}

function RiderIcon({ className = 'h-3 w-3 xl:h-3.5 xl:w-3.5 2xl:h-4 2xl:w-4' }: { className?: string } = {}) {
  return (
    <svg className={`${className} shrink-0 opacity-90`} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}

const PORTAL_ICONS: Record<PortalRole, (props?: { className?: string }) => ReactElement> = {
  organization: BuildingIcon,
  driver: WheelIcon,
  rider: RiderIcon,
};

/* ── Sub-components ── */

function PortalButton({
  role,
  userRole,
  pathname,
  fullWidth = false,
  onNavigate,
  showIcon = true,
}: {
  role: PortalRole;
  userRole: string | null;
  pathname: string;
  fullWidth?: boolean;
  onNavigate?: () => void;
  showIcon?: boolean;
}) {
  const active = isPortalActive(role, pathname, userRole);
  const Icon = PORTAL_ICONS[role];
  const config = PORTAL_CONFIG[role];

  return (
    <Link
      href={portalHref(role, userRole)}
      className={`${portalBaseClass} ${active ? portalStyles[role].active : portalStyles[role].default} ${fullWidth ? 'w-full' : ''}`}
      aria-current={active ? 'page' : undefined}
      aria-label={config.label}
      onClick={onNavigate}
    >
      {showIcon && (
        <span className={fullWidth ? 'inline-flex' : 'hidden xl:inline-flex'}>
          <Icon />
        </span>
      )}
      <span>{config.label}</span>
    </Link>
  );
}

function MobileNavLink({
  href,
  children,
  onClick,
  className = '',
}: {
  href: string;
  children: React.ReactNode;
  onClick: () => void;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`flex min-h-[44px] items-center rounded-lg px-3 font-medium text-blue-950 transition hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A8A] ${className}`}
      onClick={onClick}
    >
      {children}
    </Link>
  );
}

/* ── Main component ── */

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    const loadAuth = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setUserRole(null);
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      setUserRole(profile?.role ?? null);
    };

    loadAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadAuth();
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= DESKTOP_MIN_WIDTH) setIsOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const isNavActive = (href: string) => {
    if (href.includes('#')) return false;
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const closeMenu = () => setIsOpen(false);
  const isRider = userRole === 'rider';
  const isLoggedIn = userRole != null;

  const primaryCtaHref = isRider ? '/rider/trips/new' : '/get-a-ride';
  const primaryCtaLabel = isRider ? 'Request a Ride' : 'Get a Ride';

  const myPortalHref =
    userRole === 'organization' || userRole === 'driver' || userRole === 'rider'
      ? portalHref(userRole, userRole)
      : '/login';

  return (
    <header className="sr-header sticky top-0 z-50 border-b border-blue-100 bg-white/95 shadow-sm backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-3 sm:px-4 xl:px-6">
        {/*
          Layout: logo (fixed left) + desktop nav (ml-auto, shrink-0) + hamburger.
          No flex-1 on nav — prevents the menu from compressing/overlapping the logo.
        */}
        <div className="flex h-16 flex-nowrap items-center justify-between gap-2 lg:h-[4.25rem] xl:gap-3 2xl:h-20 2xl:gap-4">
          {/* Logo — isolated left column, never shrinks or gets overlapped */}
          <Link
            href="/"
            className="relative z-10 flex shrink-0 items-center py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A8A] focus-visible:ring-offset-2"
            aria-label="SafeRide Network home"
          >
            <Image
              src="/Safe-Ride-Network-Logo.png"
              alt="SafeRide Network"
              width={280}
              height={70}
              priority
              className="h-9 w-auto sm:h-10 lg:h-9 xl:h-12 2xl:h-[4.25rem]"
            />
          </Link>

          {/* Desktop navigation (≥1024px) */}
          <nav
            className="sr-desktop-nav ml-auto hidden shrink-0 flex-nowrap items-center gap-1 lg:flex xl:gap-2 2xl:gap-4"
            aria-label="Main navigation"
          >
            {/* Primary links */}
            <div className="flex flex-nowrap items-center gap-2 xl:gap-3 2xl:gap-5">
              {PUBLIC_NAV_LINKS.map((link) => {
                const isGetARide = link.href === '/get-a-ride';
                if (isGetARide && !isLoggedIn) {
                  return (
                    <Link
                      key={link.href}
                      href={primaryCtaHref}
                      className={`${getARideCtaClass} hidden 2xl:inline-flex`}
                    >
                      Get a Ride
                    </Link>
                  );
                }
                if (isGetARide && isLoggedIn) return null;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`${navLinkClass} ${
                      isNavActive(link.href)
                        ? 'font-semibold text-[#1E3A8A]'
                        : 'text-blue-950 hover:text-[#1E40AF]'
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>

            {/* Portal Access */}
            <div className="flex shrink-0 flex-nowrap items-center gap-1 border-l border-blue-200 pl-1.5 xl:gap-1.5 xl:pl-3 2xl:gap-2.5 2xl:pl-5">
              <div className="mr-0.5 hidden shrink-0 flex-col whitespace-nowrap 2xl:flex">
                <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-blue-600">
                  Portal Access
                </span>
                <span className="text-[10px] text-blue-400">
                  {isLoggedIn ? 'Your account' : 'Returning users'}
                </span>
              </div>
              <PortalButton role="organization" userRole={userRole} pathname={pathname} />
              <PortalButton role="driver" userRole={userRole} pathname={pathname} />
              <PortalButton role="rider" userRole={userRole} pathname={pathname} />
            </div>

            {/* Right CTAs */}
            <div className="flex shrink-0 flex-nowrap items-center gap-1.5 xl:gap-2">
              {isLoggedIn ? (
                <Link href={myPortalHref} className={signUpClass}>
                  My Portal
                </Link>
              ) : (
                <>
                  <Link href={primaryCtaHref} className={`${getARideCtaClass} 2xl:hidden`}>
                    {primaryCtaLabel}
                  </Link>
                  <Link href="/sign-up" className={signUpClass}>
                    Sign Up
                  </Link>
                </>
              )}
            </div>
          </nav>

          {/* Mobile / tablet hamburger (<1024px) */}
          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            className={`ml-auto inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-blue-200 text-blue-950 transition hover:bg-blue-50 lg:hidden ${focusRing}`}
            aria-expanded={isOpen}
            aria-controls="sr-mobile-menu"
            aria-label={isOpen ? 'Close menu' : 'Open menu'}
          >
            {isOpen ? (
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile drawer */}
        {isOpen && (
          <div
            id="sr-mobile-menu"
            className="sr-mobile-menu border-t border-blue-100 pb-5 lg:hidden"
            role="dialog"
            aria-label="Mobile navigation menu"
          >
            <nav className="space-y-0.5 py-3 text-sm" aria-label="Mobile navigation links">
              {PUBLIC_NAV_LINKS.filter((l) => l.href !== '/get-a-ride').map((link) => (
                <MobileNavLink key={link.href} href={link.href} onClick={closeMenu}>
                  {link.label}
                </MobileNavLink>
              ))}
              <MobileNavLink href={primaryCtaHref} onClick={closeMenu} className="font-semibold text-[#1E3A8A]">
                {primaryCtaLabel}
              </MobileNavLink>
              <MobileNavLink href="/apply-to-drive" onClick={closeMenu}>
                Apply to Drive
              </MobileNavLink>
            </nav>

            <div className="space-y-2.5 rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-blue-600">Portal Access</p>
                <p className="text-xs text-blue-500">
                  {isLoggedIn ? 'Go to your portal' : 'Log in to your account'}
                </p>
              </div>
              <PortalButton role="organization" userRole={userRole} pathname={pathname} fullWidth showIcon onNavigate={closeMenu} />
              <PortalButton role="driver" userRole={userRole} pathname={pathname} fullWidth showIcon onNavigate={closeMenu} />
              <PortalButton role="rider" userRole={userRole} pathname={pathname} fullWidth showIcon onNavigate={closeMenu} />
            </div>

            <div className="mt-4 space-y-3 px-1">
              {!isLoggedIn && (
                <Link href={primaryCtaHref} className={`w-full ${getARideCtaClass}`} onClick={closeMenu}>
                  Get a Ride
                </Link>
              )}
              {isLoggedIn ? (
                <Link href={myPortalHref} className={`w-full ${signUpClass}`} onClick={closeMenu}>
                  My Portal
                </Link>
              ) : (
                <Link href="/sign-up" className={`w-full ${signUpClass}`} onClick={closeMenu}>
                  Create Account — Sign Up
                </Link>
              )}
              <p className="text-center text-xs text-blue-600">
                {isLoggedIn ? (
                  <>
                    Signed in as {userRole}.{' '}
                    <Link href="/login" className="font-semibold underline hover:text-[#1E3A8A]" onClick={closeMenu}>
                      Switch account
                    </Link>
                  </>
                ) : (
                  <>
                    Already have an account?{' '}
                    <Link href="/login" className="font-semibold underline hover:text-[#1E40AF]" onClick={closeMenu}>
                      Log in
                    </Link>
                  </>
                )}
              </p>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}