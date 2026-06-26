import { redirect } from 'next/navigation';

/** Friendly URL for driver login */
export default function DriverPortalPage() {
  redirect('/login');
}