'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { enforceActiveAccount } from '@/lib/account-status';
import {
  ClipboardList,
  LayoutDashboard,
  List,
  LogOut,
  PlusCircle,
  User,
} from 'lucide-react';
import { useEdgeSwipeSidebar } from '@/lib/hooks/useEdgeSwipeSidebar';
import SidebarDrawer, {
  MenuButton,
  type PortalNavItem,
} from '@/components/portal/SidebarDrawer';
import TopBar from '@/components/layout/TopBar';

export default function OrganizationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  const openMenu = useCallback(() => setMenuOpen(true), []);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  useEdgeSwipeSidebar({
    isOpen: menuOpen,
    onOpen: openMenu,
    onClose: closeMenu,
  });

  const organizationNavItems = useMemo<PortalNavItem[]>(
    () => [
      {
        href: '/organization/dashboard',
        label: 'Dashboard',
        icon: <LayoutDashboard size={20} strokeWidth={2} />,
      },
      {
        href: '/organization/trips/new',
        label: 'Post a Trip',
        icon: <PlusCircle size={20} strokeWidth={2} />,
      },
      {
        href: '/organization/active-trips',
        label: 'Active Trips',
        icon: <List size={20} strokeWidth={2} />,
        matchPaths: ['/organization/active-trips'],
      },
      {
        href: '/organization/trips',
        label: 'My Trips',
        icon: <ClipboardList size={20} strokeWidth={2} />,
        matchPaths: ['/organization/trips'],
      },
      {
        href: '/organization/profile',
        label: 'Profile',
        icon: <User size={20} strokeWidth={2} />,
      },
    ],
    []
  );

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login');
        return;
      }

      const active = await enforceActiveAccount(supabase, user.id);
      if (!active.ok) {
        router.push('/login');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profile?.role !== 'organization') {
        router.push('/dashboard');
        return;
      }

      setUser(user);
      setLoading(false);
    };

    getUser();
  }, [router]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center">Loading...</div>;
  }

  const displayName = user?.user_metadata?.full_name || user?.email || 'Organization';

  const sidebarFooter = (
    <>
      <div className="mb-3 px-2">
        <p className="truncate text-sm font-medium text-white">{displayName}</p>
        <p className="truncate text-xs text-gray-400">{user?.email}</p>
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

  const sidebarFooterCollapsed = (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={handleSignOut}
        title="Sign out"
        className="rounded-xl p-3 text-red-400 transition-colors hover:bg-white/10"
        aria-label="Sign out"
      >
        <LogOut size={20} strokeWidth={2} />
      </button>
    </div>
  );

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      <div className="border-b bg-white px-4 py-2 text-sm sm:px-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2">
          <div className="hidden items-center gap-4 text-blue-900 sm:flex md:gap-6">
            <Link href="/" className="font-medium transition hover:text-[#1E3A8A]">
              Home
            </Link>
            <Link href="/how-it-works" className="font-medium transition hover:text-[#1E3A8A]">
              How It Works
            </Link>
          </div>
          <Link href="/" className="font-medium text-blue-900 sm:hidden">
            ← Home
          </Link>
          <div className="text-xs font-semibold text-[#1E3A8A]">Organization Portal</div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <SidebarDrawer
          isOpen={menuOpen}
          onClose={closeMenu}
          logoHref="/organization/dashboard"
          navItems={organizationNavItems}
          portalSubtitle="Organization Portal"
          footer={sidebarFooter}
          footerCollapsed={sidebarFooterCollapsed}
          storageKey="orgSidebarCollapsed"
          legacyStorageKey="org-sidebar-collapsed"
          theme="dark"
        />

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <TopBar
            title="Organization Portal"
            userName={displayName}
            portalType="Organization"
            profileHref="/organization/profile"
            onSignOut={handleSignOut}
            menuButton={<MenuButton onClick={openMenu} theme="dark" />}
          />

          <div className="flex-1 overflow-auto p-4 text-blue-950 sm:p-6 lg:p-8">
            <div className="mx-auto max-w-7xl">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}