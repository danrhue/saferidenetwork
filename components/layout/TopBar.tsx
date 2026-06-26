'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Bell, ChevronDown, LogOut, User } from 'lucide-react';

type TopBarProps = {
  title: string;
  userName?: string;
  portalType?: string;
  profileHref?: string;
  onSignOut: () => void;
  profilePhotoUrl?: string | null;
  menuButton?: ReactNode;
  notifications?: ReactNode;
  notificationHref?: string;
};

function DefaultNotificationButton({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="relative rounded-xl p-2 text-gray-600 transition hover:bg-gray-100"
      aria-label="Notifications"
    >
      <Bell size={20} strokeWidth={2} />
    </Link>
  );
}

export default function TopBar({
  title,
  userName = 'User',
  portalType = 'Portal',
  profileHref,
  onSignOut,
  profilePhotoUrl,
  menuButton,
  notifications,
  notificationHref,
}: TopBarProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const displayName = userName.trim() || 'User';
  const initial = displayName.charAt(0).toUpperCase();

  useEffect(() => {
    if (!showDropdown) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDropdown]);

  const handleSignOut = () => {
    setShowDropdown(false);
    onSignOut();
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center border-b bg-white px-4 shadow-sm sm:px-6 lg:px-8">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {menuButton}
        <h1 className="truncate text-xl font-semibold text-gray-900 sm:text-2xl">{title}</h1>
      </div>

      <div className="flex items-center gap-3 sm:gap-6">
        {notifications ??
          (notificationHref ? <DefaultNotificationButton href={notificationHref} /> : null)}

        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setShowDropdown((open) => !open)}
            className="flex items-center gap-2 rounded-2xl px-2 py-2 transition hover:bg-gray-100 sm:gap-3 sm:px-4"
            aria-expanded={showDropdown}
            aria-haspopup="menu"
          >
            {profilePhotoUrl ? (
              <img
                src={profilePhotoUrl}
                alt=""
                className="h-8 w-8 rounded-full border border-gray-200 object-cover"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1E3A8A] text-sm font-medium text-white">
                {initial}
              </div>
            )}
            <div className="hidden text-left sm:block">
              <div className="max-w-[10rem] truncate text-sm font-medium text-gray-900 md:max-w-none">
                {displayName}
              </div>
              <div className="-mt-0.5 text-xs text-gray-500">{portalType} Portal</div>
            </div>
            <ChevronDown size={16} className="hidden text-gray-400 sm:block" />
          </button>

          {showDropdown && (
            <div
              role="menu"
              className="absolute right-0 mt-2 w-56 rounded-2xl border bg-white py-2 shadow-xl"
            >
              {profileHref && (
                <Link
                  href={profileHref}
                  role="menuitem"
                  onClick={() => setShowDropdown(false)}
                  className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 transition hover:bg-gray-50"
                >
                  <User size={18} strokeWidth={2} />
                  Profile Settings
                </Link>
              )}
              <button
                type="button"
                role="menuitem"
                onClick={handleSignOut}
                className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-red-600 transition hover:bg-gray-50"
              >
                <LogOut size={18} strokeWidth={2} />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}