'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export type PortalNavItem = {
  href: string;
  label: string;
};

type OrganizationMobileNavProps = {
  isOpen: boolean;
  onClose: () => void;
  navItems: PortalNavItem[];
};

export function OrganizationMenuButton({
  onClick,
}: {
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 text-white hover:bg-white/10 md:hidden"
      aria-label="Open menu"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-5 w-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    </button>
  );
}

export default function OrganizationMobileNav({
  isOpen,
  onClose,
  navItems,
}: OrganizationMobileNavProps) {
  const pathname = usePathname();

  useEffect(() => {
    onClose();
  }, [pathname]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 bg-black/50 md:hidden"
        onClick={onClose}
        aria-label="Close menu"
      />
      <div className="fixed inset-x-0 top-16 z-50 border-b border-white/10 bg-[#0F172A] shadow-lg md:hidden">
        <nav className="max-h-[calc(100vh-4rem)] overflow-y-auto px-4 py-3">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`flex min-h-[44px] items-center rounded-2xl px-5 py-3.5 text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-white text-[#1E3A8A] shadow-sm'
                    : 'text-gray-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
}