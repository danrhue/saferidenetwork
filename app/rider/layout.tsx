'use client';

/**
 * Rider Portal shell — auth guard (role=rider), sidebar navigation, notification bell.
 */

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { createProfilePhotoSignedUrl } from '@/lib/storage/profile-photos';
import { enforceActiveAccount } from '@/lib/account-status';
import SidebarDrawer, { MenuButton } from '@/components/portal/SidebarDrawer';
import TopBar from '@/components/layout/TopBar';
import { riderNavItems } from '@/components/rider/rider-nav-items';
import NotificationBell from '@/components/rider/NotificationBell';
import RiderLoadingSpinner from '@/components/rider/RiderLoadingSpinner';

type UserProfile = {
  full_name: string | null;
  role: string;
  profile_photo_url: string | null;
};

/** Send authenticated users to the portal that matches their role. */
function redirectForRole(role: string | undefined, router: ReturnType<typeof useRouter>) {
  if (role === 'organization') {
    router.replace('/organization/dashboard');
    return;
  }
  if (role === 'driver') {
    router.replace('/dashboard');
    return;
  }
  if (role === 'rider') {
    router.replace('/rider/dashboard');
    return;
  }
  // Unknown role — default to login
  router.replace('/login');
}

export default function RiderLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  useEffect(() => {
    const loadSession = async () => {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (!authUser) {
        router.replace('/login');
        return;
      }

      const active = await enforceActiveAccount(supabase, authUser.id);
      if (!active.ok) {
        router.replace('/login');
        return;
      }

      const { data: prof, error } = await supabase
        .from('profiles')
        .select('full_name, role, profile_photo_url')
        .eq('id', authUser.id)
        .single();

      if (error || !prof) {
        router.replace('/login');
        return;
      }

      // Rider portal is only for rider accounts
      if (prof.role !== 'rider') {
        redirectForRole(prof.role, router);
        return;
      }

      setUser({ id: authUser.id, email: authUser.email });
      setProfile(prof);

      if (prof.profile_photo_url) {
        const signedUrl = await createProfilePhotoSignedUrl(supabase, prof.profile_photo_url);
        setProfilePhoto(signedUrl);
      }

      setLoading(false);
    };

    loadSession();
  }, [router]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace('/login');
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <RiderLoadingSpinner message="Loading Rider Portal..." />
      </div>
    );
  }

  const displayName = profile?.full_name || user?.email || 'Rider';

  const profileAvatar = profilePhoto ? (
    <img
      src={profilePhoto}
      alt="Profile"
      className="h-8 w-8 rounded-full border border-white/20 object-cover"
    />
  ) : (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-sm text-white">
      👤
    </div>
  );

  const sidebarFooter = (
    <>
      <div className="mb-3 flex items-center gap-3 px-2">
        {profileAvatar}
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-white">{displayName}</p>
          <p className="truncate text-xs text-gray-400">{user?.email}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={handleSignOut}
        className="w-full rounded-xl py-3 text-center text-sm font-medium text-red-400 transition-colors hover:bg-white/10"
      >
        Sign Out
      </button>
    </>
  );

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      {/* Public site links — condensed on mobile */}
      <div className="border-b bg-white px-4 py-2 text-sm sm:px-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2">
          <div className="hidden items-center gap-4 text-blue-900 sm:flex md:gap-6">
            <Link href="/" className="font-medium transition hover:text-[#1E3A8A]">
              Home
            </Link>
            <Link href="/how-it-works" className="font-medium transition hover:text-[#1E3A8A]">
              How It Works
            </Link>
            <Link href="/get-a-ride" className="font-medium transition hover:text-[#1E3A8A]">
              Get a Ride
            </Link>
          </div>
          <Link href="/" className="font-medium text-blue-900 sm:hidden">
            ← Home
          </Link>
          <div className="text-xs font-semibold text-[#1E3A8A]">Rider Portal</div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <SidebarDrawer
          isOpen={menuOpen}
          onClose={closeMenu}
          logoHref="/rider/dashboard"
          navItems={riderNavItems}
          portalSubtitle="Rider Portal"
          footer={sidebarFooter}
          theme="dark"
        />

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <TopBar
            title="Rider Portal"
            userName={displayName}
            portalType="Rider"
            profileHref="/rider/profile"
            profilePhotoUrl={profilePhoto}
            onSignOut={handleSignOut}
            notifications={<NotificationBell />}
            menuButton={
              <MenuButton
                onClick={() => setMenuOpen(true)}
                label="Open rider menu"
                theme="dark"
              />
            }
          />

          <div className="flex-1 overflow-auto p-4 text-blue-950 sm:p-6 lg:p-8">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}