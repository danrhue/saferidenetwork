'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ADMIN_FORBIDDEN_ERROR } from '@/lib/admin-access';

/** Set true to skip admin profile checks during debugging. REMOVE before production. */
const ADMIN_SHELL_BYPASS = true;
import { useEdgeSwipeSidebar } from '@/lib/hooks/useEdgeSwipeSidebar';
import { AdminSidebar, AdminMenuButton } from '@/components/admin/AdminSidebar';
import TopBar from '@/components/layout/TopBar';

const ADMIN_SIDEBAR_STORAGE_KEY = 'adminSidebarCollapsed';
const LEGACY_ADMIN_SIDEBAR_STORAGE_KEY = 'admin-sidebar-collapsed';

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<{ email?: string; user_metadata?: { full_name?: string } } | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      const stored =
        localStorage.getItem(ADMIN_SIDEBAR_STORAGE_KEY) ??
        localStorage.getItem(LEGACY_ADMIN_SIDEBAR_STORAGE_KEY);
      if (stored === 'true') {
        setCollapsed(true);
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(ADMIN_SIDEBAR_STORAGE_KEY, String(collapsed));
    } catch {
      // ignore storage errors
    }
  }, [collapsed]);

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        router.replace('/admin/login');
        return;
      }

      if (!ADMIN_SHELL_BYPASS) {
        const { enforceActiveAccount } = await import('@/lib/account-status');
        const { ADMIN_FORBIDDEN_ERROR, canAccessAdmin } = await import('@/lib/admin-access');

        const active = await enforceActiveAccount(supabase, authUser.id);
        if (!active.ok) {
          router.replace('/admin/login');
          return;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('is_admin, deleted_at, role')
          .eq('id', authUser.id)
          .single();

        if (!canAccessAdmin(profile)) {
          if (pathname === '/admin') {
            setForbidden(true);
            setLoading(false);
            return;
          }
          router.replace(`/admin?error=${encodeURIComponent(ADMIN_FORBIDDEN_ERROR)}`);
          return;
        }
      } else {
        console.warn('⚠️ ADMIN SHELL BYPASS ACTIVE');
      }

      setForbidden(false);
      setUser(authUser);
      setLoading(false);
    };

    checkAdmin();
  }, [pathname, router]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const toggleCollapsed = () => {
    setCollapsed((prev) => !prev);
  };

  const openMenu = useCallback(() => setMenuOpen(true), []);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  useEdgeSwipeSidebar({
    isOpen: menuOpen,
    onOpen: openMenu,
    onClose: closeMenu,
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-blue-950">
        Loading admin portal...
      </div>
    );
  }

  if (forbidden) {
    const errorMessage = ADMIN_FORBIDDEN_ERROR;
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-bold text-red-900">Access denied</h1>
          <p className="mt-3 text-sm text-gray-600">{errorMessage}</p>
          <button
            type="button"
            onClick={handleSignOut}
            className="mt-6 rounded-xl bg-[#1E3A8A] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#162d6b]"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Desktop sidebar */}
      <div
        className={`hidden h-screen shrink-0 transition-all duration-300 lg:sticky lg:top-0 lg:block ${
          collapsed ? 'w-20' : 'w-72'
        }`}
      >
        <AdminSidebar
          userName={user?.user_metadata?.full_name}
          userEmail={user?.email}
          onSignOut={handleSignOut}
          collapsed={collapsed}
          onToggleCollapse={toggleCollapsed}
        />
      </div>

      {/* Mobile sidebar overlay */}
      {menuOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={closeMenu}
          aria-label="Close menu"
        />
      )}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-72 transition-transform duration-300 lg:hidden ${
          menuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <AdminSidebar
          onNavigate={closeMenu}
          showMobileClose
          userName={user?.user_metadata?.full_name}
          userEmail={user?.email}
          onSignOut={handleSignOut}
        />
      </div>

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          title="Admin Portal"
          userName={user?.user_metadata?.full_name || user?.email}
          portalType="Admin"
          onSignOut={handleSignOut}
          menuButton={<AdminMenuButton onClick={openMenu} />}
        />

        <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}