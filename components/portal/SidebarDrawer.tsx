'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';

export type PortalNavItem = {
  href: string;
  label: string;
  badge?: string;
  icon?: ReactNode;
  /** Additional path prefixes that should mark this link active */
  matchPaths?: string[];
};

export type PortalNavSection = {
  title?: string;
  items: PortalNavItem[];
};

export type PortalTheme = 'light' | 'dark';

type SidebarDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  logoHref: string;
  navItems?: PortalNavItem[];
  navSections?: PortalNavSection[];
  portalSubtitle?: string;
  footer?: ReactNode;
  footerCollapsed?: ReactNode;
  collapsible?: boolean;
  storageKey?: string;
  legacyStorageKey?: string;
  theme?: PortalTheme;
};

function renderNavLink(
  item: PortalNavItem,
  pathname: string,
  logoHref: string,
  onClose: () => void,
  collapsed: boolean,
  theme: PortalTheme
) {
  const isActive =
    pathname === item.href ||
    (item.href !== logoHref && pathname.startsWith(`${item.href}/`)) ||
    (item.matchPaths?.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
    ) ??
      false);

  return (
    <Link
      key={item.href}
      href={item.href}
      onClick={onClose}
      title={collapsed ? item.label : undefined}
      aria-label={collapsed ? item.label : undefined}
      className={`group flex min-h-9 items-center gap-2.5 rounded-xl text-xs font-medium transition-all ${
        collapsed ? 'justify-center px-2 py-2' : theme === 'dark' ? 'px-3 py-2' : 'px-3 py-2'
      } ${
        isActive
          ? theme === 'dark'
            ? 'bg-white text-[#1E3A8A] shadow-sm'
            : 'bg-[#1E3A8A] text-white'
          : theme === 'dark'
            ? 'text-gray-300 hover:bg-white/10 hover:text-white'
            : 'text-blue-950 hover:bg-gray-100'
      }`}
    >
      {item.icon && (
        <span
          className={`shrink-0 transition-colors ${
            isActive
              ? theme === 'dark'
                ? 'text-[#1E3A8A]'
                : 'text-white'
              : theme === 'dark'
                ? 'text-gray-400 group-hover:text-white'
                : 'text-gray-500 group-hover:text-blue-950'
          }`}
          aria-hidden
        >
          {item.icon}
        </span>
      )}
      {!collapsed && <span className="min-w-0 flex-1">{item.label}</span>}
      {!collapsed && item.badge && (
        <span
          className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${
            isActive
              ? theme === 'dark'
                ? 'bg-[#1E3A8A]/10 text-[#1E3A8A]'
                : 'bg-white/20 text-white'
              : theme === 'dark'
                ? 'bg-white/10 text-gray-300'
                : 'bg-gray-100 text-gray-600 group-hover:bg-white/20 group-hover:text-white'
          }`}
        >
          {item.badge}
        </span>
      )}
    </Link>
  );
}

export default function SidebarDrawer({
  isOpen,
  onClose,
  logoHref,
  navItems,
  navSections,
  portalSubtitle,
  footer,
  footerCollapsed,
  collapsible = true,
  storageKey = 'driverSidebarCollapsed',
  legacyStorageKey = 'driver-sidebar-collapsed',
  theme = 'light',
}: SidebarDrawerProps) {
  const pathname = usePathname();
  const sections: PortalNavSection[] =
    navSections ?? (navItems ? [{ items: navItems }] : []);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!collapsible) return;
    try {
      const stored =
        localStorage.getItem(storageKey) ??
        (legacyStorageKey ? localStorage.getItem(legacyStorageKey) : null);
      if (stored === 'true') {
        setCollapsed(true);
      }
    } catch {
      // ignore storage errors
    }
  }, [collapsible, storageKey, legacyStorageKey]);

  useEffect(() => {
    if (!collapsible) return;
    try {
      localStorage.setItem(storageKey, String(collapsed));
    } catch {
      // ignore storage errors
    }
  }, [collapsed, collapsible, storageKey]);

  useEffect(() => {
    onClose();
  }, [pathname, onClose]);

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

  const toggleCollapsed = () => {
    setCollapsed((prev) => !prev);
  };

  const isCollapsedDesktop = collapsible && collapsed;

  return (
    <>
      {isOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={onClose}
          aria-label="Close menu"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex max-w-[85vw] flex-col border-r shadow-xl transition-all duration-300 ease-out lg:static lg:z-auto lg:max-w-none lg:translate-x-0 lg:shadow-none ${
          theme === 'dark' ? 'bg-[#0F172A] text-white border-white/10' : 'bg-white'
        } ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } w-72 ${isCollapsedDesktop ? 'lg:w-20' : 'lg:w-72'}`}
      >
        <div
          className={`shrink-0 border-b ${theme === 'dark' ? 'border-white/10' : ''} ${
            isCollapsedDesktop ? 'p-3' : 'p-4 lg:p-5'
          }`}
        >
          <div className="relative flex flex-col items-center text-center">
            <button
              type="button"
              onClick={onClose}
              className={`absolute right-0 top-0 rounded-lg p-1.5 lg:hidden ${
                theme === 'dark'
                  ? 'text-gray-300 hover:bg-white/10 hover:text-white'
                  : 'text-blue-950 hover:bg-gray-100'
              }`}
              aria-label="Close menu"
            >
              <X size={20} strokeWidth={2} />
            </button>

            <Link href={logoHref} onClick={onClose} className="flex flex-col items-center">
              <div
                className={`mb-2 rounded-2xl bg-white p-2.5 shadow-md ${
                  isCollapsedDesktop ? 'lg:mb-0 lg:rounded-xl lg:p-2' : ''
                }`}
              >
                <img
                  src="/Safe-Ride-Network-Logo.png"
                  alt="Safe Ride Network"
                  className={`h-12 w-auto ${isCollapsedDesktop ? 'lg:h-8' : ''}`}
                />
              </div>
              {portalSubtitle && (
                <div
                  className={`text-center text-[11px] font-medium uppercase tracking-widest ${
                    isCollapsedDesktop ? 'lg:hidden' : ''
                  } ${theme === 'dark' ? 'text-blue-400' : 'text-[#1E3A8A]'}`}
                >
                  {portalSubtitle}
                </div>
              )}
            </Link>
          </div>
        </div>

        <nav
          className={`min-h-0 flex-1 overflow-y-auto lg:overflow-y-visible ${
            isCollapsedDesktop ? 'p-2' : 'p-2 lg:p-3'
          }`}
        >
          {sections.map((section, index) => (
            <div key={section.title ?? `section-${index}`} className={index > 0 ? 'pt-2' : ''}>
              {section.title && !isCollapsedDesktop && (
                <div
                  className={`mb-1 px-3 text-[10px] font-semibold uppercase tracking-wide ${
                    theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                  }`}
                >
                  {section.title}
                </div>
              )}
              <div className="space-y-0.5">
                {section.items.map((item) =>
                  renderNavLink(item, pathname, logoHref, onClose, isCollapsedDesktop, theme)
                )}
              </div>
            </div>
          ))}
        </nav>

        {(footer || footerCollapsed) && (
          <div
            className={`shrink-0 border-t ${theme === 'dark' ? 'border-white/10' : ''} ${
              isCollapsedDesktop ? 'p-2' : 'p-3'
            }`}
          >
            {isCollapsedDesktop ? footerCollapsed ?? footer : footer}
          </div>
        )}

        {collapsible && (
          <div
            className={`hidden shrink-0 border-t lg:block ${
              theme === 'dark' ? 'border-white/10' : ''
            } p-2`}
          >
            <button
              type="button"
              onClick={toggleCollapsed}
              className={`flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition-colors ${
                theme === 'dark'
                  ? 'text-gray-300 hover:bg-white/10 hover:text-white'
                  : 'text-blue-950 hover:bg-gray-100'
              } ${isCollapsedDesktop ? 'px-0' : ''}`}
              aria-label={isCollapsedDesktop ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {isCollapsedDesktop ? (
                <PanelLeftOpen size={18} strokeWidth={2} />
              ) : (
                <>
                  <PanelLeftClose size={18} strokeWidth={2} />
                  <span>Collapse Sidebar</span>
                </>
              )}
            </button>
          </div>
        )}
      </aside>
    </>
  );
}

export function MenuButton({
  onClick,
  label = 'Open menu',
  theme = 'light',
}: {
  onClick: () => void;
  label?: string;
  theme?: PortalTheme;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-11 w-11 items-center justify-center rounded-xl border lg:hidden ${
        theme === 'dark'
          ? 'border-gray-200 text-[#1E3A8A] hover:bg-gray-100'
          : 'border-blue-200 text-blue-950 hover:bg-blue-50'
      }`}
      aria-label={label}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-6 w-6"
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