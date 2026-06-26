'use client';

import { useParams, useSearchParams } from 'next/navigation';
import AdminDriverDetailView from '@/components/admin/AdminDriverDetailView';

type TabId = 'profile' | 'documents' | 'photo';

function parseInitialTab(value: string | null): TabId {
  if (value === 'documents' || value === 'photo') return value;
  return 'profile';
}

export default function AdminDriverDetailPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const driverId = params.id;
  const initialTab = parseInitialTab(searchParams.get('tab'));

  if (!driverId) {
    return <p className="text-red-600">Missing driver id.</p>;
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <AdminDriverDetailView driverId={driverId} initialTab={initialTab} />
    </div>
  );
}