/** Shared portal destinations for public header and footer. */

export type PortalRole = 'organization' | 'driver' | 'rider';

export const PORTAL_CONFIG: Record<
  PortalRole,
  {
    label: string;
    dashboardHref: string;
    loginHref: string;
    loginLabel: string;
  }
> = {
  organization: {
    label: 'Organization Portal',
    dashboardHref: '/organization/dashboard',
    loginHref: '/login',
    loginLabel: 'Organization Portal',
  },
  driver: {
    label: 'Driver Portal',
    dashboardHref: '/dashboard',
    loginHref: '/login',
    loginLabel: 'Driver Portal',
  },
  rider: {
    label: 'Rider Portal',
    dashboardHref: '/rider/dashboard',
    loginHref: '/login',
    loginLabel: 'Rider Portal',
  },
};

export function portalHref(role: PortalRole, userRole: string | null): string {
  return userRole === role ? PORTAL_CONFIG[role].dashboardHref : PORTAL_CONFIG[role].loginHref;
}

export function isPortalActive(role: PortalRole, pathname: string, userRole: string | null): boolean {
  if (userRole === role) return true;
  const prefixes: Record<PortalRole, string> = {
    organization: '/organization',
    driver: '/dashboard',
    rider: '/rider',
  };
  return pathname.startsWith(prefixes[role]);
}

export const PUBLIC_NAV_LINKS = [
  { href: '/how-it-works', label: 'How It Works' },
  { href: '/how-it-works#organizations', label: 'For Organizations' },
  { href: '/apply-to-drive', label: 'For Drivers' },
  { href: '/get-a-ride', label: 'Get a Ride', prominent: true },
] as const;