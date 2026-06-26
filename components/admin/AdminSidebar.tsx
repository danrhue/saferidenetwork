'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { LogOut, Menu, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import {
  adminNavItems,
  renderAdminNavIcon,
} from '@/components/admin/admin-nav-items';

type AdminSidebarProps = {
  onNavigate?: () => void;
  userName?: string;
  userEmail?: string;
  onSignOut: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  showMobileClose?: boolean;
};

function isNavItemActive(
  pathname: string,
  href: string,
  matchPaths?: string[]
): boolean {
  if (pathname === href) return true;
  if (href !== '/admin' && pathname.startsWith(`${href}/`)) return true;
  return (
    matchPaths?.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
    ) ?? false
  );
}

export function AdminSidebar({
  onNavigate,
  userName,
  userEmail,
  onSignOut,
  collapsed = false,
  onToggleCollapse,
  showMobileClose = false,
}: AdminSidebarProps) {
  const pathname = usePathname();
  const canCollapse = typeof onToggleCollapse === 'function';

  return (
    <div className="flex h-full w-full flex-col bg-[#0F172A] text-white">
      <div className={`border-b border-white/10 ${collapsed ? 'p-4' : 'p-8'}`}>
        <div className="relative flex flex-col items-center text-center">
          {showMobileClose && onNavigate && (
            <button
              type="button"
              onClick={onNavigate}
              className="absolute right-0 top-0 rounded-xl p-2 text-gray-300 hover:bg-white/10 hover:text-white lg:hidden"
              aria-label="Close menu"
            >
              <X size={22} strokeWidth={2} />
            </button>
          )}

          <Link href="/admin" onClick={onNavigate} className="flex flex-col items-center">
            <div
              className={`mb-4 rounded-3xl bg-white p-4 shadow-md ${
                collapsed ? 'lg:mb-0 lg:rounded-2xl lg:p-2.5' : ''
              }`}
            >
              <Image
                src="/Safe-Ride-Network-Logo.png"
                alt="Safe Ride Network"
                width={64}
                height={64}
                className={`h-16 w-auto ${collapsed ? 'lg:h-9' : ''}`}
              />
            </div>
            <div
              className={`text-center text-sm font-medium uppercase tracking-widest text-blue-400 ${
                collapsed ? 'lg:hidden' : ''
              }`}
            >
              Admin Portal
            </div>
          </Link>
        </div>
      </div>

      <nav className={`flex-1 space-y-1 overflow-y-auto ${collapsed ? 'p-2' : 'p-4'}`}>
        {adminNavItems.map((item) => {
          const isActive = isNavItemActive(pathname, item.href, item.matchPaths);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              title={collapsed ? item.label : undefined}
              aria-label={collapsed ? item.label : undefined}
              className={`group flex min-h-[44px] items-center gap-3 rounded-2xl text-sm font-medium transition-all ${
                collapsed ? 'justify-center px-3 py-3.5' : 'px-5 py-3.5'
              } ${
                isActive
                  ? 'bg-white text-[#1E3A8A] shadow-sm'
                  : 'text-gray-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <span
                className={`shrink-0 transition-colors ${
                  isActive ? 'text-[#1E3A8A]' : 'text-gray-400 group-hover:text-white'
                }`}
              >
                {renderAdminNavIcon(item)}
              </span>
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className={`mt-auto border-t border-white/10 ${collapsed ? 'p-2' : 'p-4'}`}>
        {!collapsed && (userName || userEmail) && (
          <div className="mb-3 px-2">
            <p className="truncate text-sm font-medium text-white">{userName || 'Admin'}</p>
            {userEmail && <p className="truncate text-xs text-gray-400">{userEmail}</p>}
          </div>
        )}
        <button
          onClick={onSignOut}
          title="Sign out"
          className={`w-full rounded-xl text-sm font-medium text-red-400 transition-colors hover:bg-white/10 ${
            collapsed ? 'flex items-center justify-center p-3' : 'py-3 text-center'
          }`}
        >
          {collapsed ? <LogOut size={20} strokeWidth={2} /> : 'Sign Out'}
        </button>
        {!collapsed && (
          <Link
            href="/"
            onClick={onNavigate}
            className="mt-2 block w-full rounded-xl py-2 text-center text-xs text-gray-400 transition-colors hover:text-white"
          >
            ← Back to site
          </Link>
        )}
      </div>

      {canCollapse && (
        <div className="hidden border-t border-white/10 p-4 lg:block">
          <button
            type="button"
            onClick={onToggleCollapse}
            className={`flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-medium text-gray-300 transition-colors hover:bg-white/10 hover:text-white ${
              collapsed ? 'px-0' : ''
            }`}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? (
              <PanelLeftOpen size={20} strokeWidth={2} />
            ) : (
              <>
                <PanelLeftClose size={20} strokeWidth={2} />
                <span>Collapse Sidebar</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

export function AdminMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-gray-200 text-[#1E3A8A] hover:bg-gray-100 lg:hidden"
      aria-label="Open admin menu"
    >
      <Menu size={24} strokeWidth={2} aria-hidden />
    </button>
  );
}