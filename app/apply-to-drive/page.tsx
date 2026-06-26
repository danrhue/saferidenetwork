import type { Metadata } from 'next';
import ApplyToDrivePage from '@/components/public/ApplyToDrivePage';

export const metadata: Metadata = {
  title: 'Apply to Drive | SafeRide Network — Nationwide Independent Driver Opportunities',
  description:
    'Apply to drive with SafeRide Network nationwide. Create your Driver account, upload documents in your portal, and start earning on real trips posted by organizations across the United States.',
  openGraph: {
    title: 'Apply to Drive with SafeRide Network',
    description:
      'Create a Driver Account → Upload Documents → Start Earning. Join the nationwide transportation marketplace today.',
    type: 'website',
  },
};

export default function ApplyToDriveRoute() {
  return <ApplyToDrivePage />;
}