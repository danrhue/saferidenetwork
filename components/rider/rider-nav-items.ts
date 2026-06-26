import type { PortalNavItem } from '@/components/portal/SidebarDrawer';

/** Primary navigation for the Rider Portal (Phase 1). */
export const riderNavItems: PortalNavItem[] = [
  { href: '/rider/dashboard', label: 'Home' },
  { href: '/rider/trips/new', label: 'Request a Ride' },
  { href: '/rider/trips', label: 'My Trips' },
  { href: '/rider/notifications', label: 'Notifications' },
  { href: '/rider/profile', label: 'My Profile' },
  { href: '/rider/settings/matching', label: 'Matching Settings' },
];