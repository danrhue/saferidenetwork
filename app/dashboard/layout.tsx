'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ProfileCompletionProvider,
  useProfileCompletion,
} from '@/lib/driver/useProfileCompletion';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { resolveProfilePhotoForProfile } from '@/lib/storage/profile-photos';
import { enforceActiveAccount } from '@/lib/account-status';
import {
  Bell,
  ClipboardList,
  CreditCard,
  FileText,
  LayoutDashboard,
  LogOut,
  MapPin,
  Navigation,
  Star,
  User,
} from 'lucide-react';
import { useEdgeSwipeSidebar } from '@/lib/hooks/useEdgeSwipeSidebar';
import SidebarDrawer, {
  MenuButton,
  type PortalNavSection,
} from '@/components/portal/SidebarDrawer';
import TopBar from '@/components/layout/TopBar';
import {
  WizardLeaveGuardProvider,
  useWizardLeaveGuard,
} from '@/components/driver/WizardLeaveGuard';

function DashboardLayoutShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { confirmLeave } = useWizardLeaveGuard();
  const [user, setUser] = useState<any>(null);
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const { profileCompletion, documentsApproved, totalDocuments, refresh } =
    useProfileCompletion();

  const openMenu = useCallback(() => setMenuOpen(true), []);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  useEdgeSwipeSidebar({
    isOpen: menuOpen,
    onOpen: openMenu,
    onClose: closeMenu,
  });

  const driverNavSections = useMemo<PortalNavSection[]>(
    () => [
      {
        title: 'MAIN',
        items: [
          {
            href: '/dashboard',
            label: 'Overview',
            icon: <LayoutDashboard size={20} strokeWidth={2} />,
          },
        ],
      },
      {
        title: 'PROFILE & COMPLIANCE',
        items: [
          {
            href: '/dashboard/profile',
            label: 'My Profile',
            icon: <User size={20} strokeWidth={2} />,
            badge: `${profileCompletion}%`,
          },
          {
            href: '/dashboard/documents',
            label: 'My Documents',
            icon: <FileText size={20} strokeWidth={2} />,
            badge: `${documentsApproved}/${totalDocuments}`,
          },
        ],
      },
      {
        title: 'TRIPS',
        items: [
          {
            href: '/dashboard/trips',
            label: 'Browse Trips',
            icon: <MapPin size={20} strokeWidth={2} />,
          },
          {
            href: '/dashboard/my-offers',
            label: 'My Offers',
            icon: <ClipboardList size={20} strokeWidth={2} />,
            description:
              'Trips you have offered on. You will be notified if an organization assigns one to you.',
          },
          {
            href: '/dashboard/active-trips',
            label: 'Active Trips',
            icon: <Navigation size={20} strokeWidth={2} />,
            matchPaths: ['/dashboard/trip'],
            description:
              'Trips you have been assigned to. Open the trip to start navigation and manage your route.',
          },
        ],
      },
      {
        title: 'ACCOUNT',
        items: [
          {
            href: '/dashboard/payments',
            label: 'Payments',
            icon: <CreditCard size={20} strokeWidth={2} />,
          },
          {
            href: '/dashboard/ratings',
            label: 'My Ratings',
            icon: <Star size={20} strokeWidth={2} />,
          },
          {
            href: '/dashboard/updates',
            label: 'Company Updates',
            icon: <Bell size={20} strokeWidth={2} />,
          },
        ],
      },
    ],
    [profileCompletion, documentsApproved, totalDocuments]
  );

  useEffect(() => {
    refresh();
  }, [pathname, refresh]);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
      } else {
        const active = await enforceActiveAccount(supabase, user.id);
        if (!active.ok) {
          router.push('/login');
          return;
        }
        setUser(user);
        const { data: prof } = await supabase
          .from('profiles')
          .select('profile_photo_url, profile_photo_status')
          .eq('id', user.id)
          .single();
        if (prof?.profile_photo_url) {
          const photoUrl = await resolveProfilePhotoForProfile(supabase, prof, { isOwner: true });
          setProfilePhoto(photoUrl);
        }
      }
      setLoading(false);
    };
    getUser();
  }, [router]);

  const handleSignOut = () => {
    confirmLeave(() => {
      void (async () => {
        await supabase.auth.signOut();
        router.push('/login');
      })();
    });
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  const profileAvatar = profilePhoto ? (
    <img src={profilePhoto} alt="Profile" className="h-8 w-8 rounded-full border border-white/20 object-cover" />
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
          <p className="truncate text-sm font-medium text-white">{user?.user_metadata?.full_name}</p>
          <p className="truncate text-xs text-gray-400">{user?.email}</p>
        </div>
      </div>
      <button
        onClick={handleSignOut}
        className="w-full rounded-xl py-3 text-center text-sm font-medium text-red-400 transition-colors hover:bg-white/10"
      >
        Sign Out
      </button>
    </>
  );

  const sidebarFooterCollapsed = (
    <div className="flex flex-col items-center gap-3">
      {profileAvatar}
      <button
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
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <SidebarDrawer
          isOpen={menuOpen}
          onClose={closeMenu}
          logoHref="/dashboard"
          navSections={driverNavSections}
          portalSubtitle="Driver Portal"
          footer={sidebarFooter}
          footerCollapsed={sidebarFooterCollapsed}
          storageKey="driverSidebarCollapsed"
          legacyStorageKey="driver-sidebar-collapsed"
          theme="dark"
        />

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <TopBar
            title="Driver Portal"
            userName={user?.user_metadata?.full_name || user?.email}
            portalType="Driver"
            profileHref="/dashboard/profile"
            profilePhotoUrl={profilePhoto}
            onSignOut={handleSignOut}
            notificationHref="/dashboard/updates"
            menuButton={<MenuButton onClick={openMenu} theme="dark" />}
          />

          <div className="flex-1 overflow-auto p-4 text-blue-950 sm:p-6 lg:p-8">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <WizardLeaveGuardProvider>
      <ProfileCompletionProvider>
        <DashboardLayoutShell>{children}</DashboardLayoutShell>
      </ProfileCompletionProvider>
    </WizardLeaveGuardProvider>
  );
}