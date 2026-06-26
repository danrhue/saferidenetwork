'use client';

import {
  Archive,
  Bell,
  Building2,
  Camera,
  Car,
  FileCheck,
  LayoutDashboard,
  MapPin,
  Route,
  Settings,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';

export type AdminNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  matchPaths?: string[];
};

function navIcon(Icon: LucideIcon): ReactNode {
  return <Icon size={20} strokeWidth={2} aria-hidden />;
}

export const adminNavItems: AdminNavItem[] = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard },
  { href: '/admin/drivers', label: 'Drivers', icon: Users },
  { href: '/admin/organizations', label: 'Organizations', icon: Building2 },
  { href: '/admin/trips', label: 'Trips', icon: Route },
  { href: '/admin/documents', label: 'Document Review', icon: FileCheck },
  {
    href: '/admin/profile-photos',
    label: 'Profile Photos',
    icon: Camera,
    matchPaths: ['/admin/profile-photos'],
  },
  { href: '/admin/seating-approvals', label: 'Seating Review', icon: Car },
  {
    href: '/admin/active-trips',
    label: 'Live Trips',
    icon: MapPin,
    matchPaths: ['/admin/active-trips'],
  },
  { href: '/admin/deleted-items', label: 'Deleted Items', icon: Archive },
  { href: '/admin/updates', label: 'Company Updates', icon: Bell },
  { href: '/admin/pricing', label: 'Pricing', icon: Settings },
];

export function renderAdminNavIcon(item: AdminNavItem): ReactNode {
  return navIcon(item.icon);
}