'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import PendingTasksSection from '@/components/driver/PendingTasksSection';
import { useDriverOverview } from '@/lib/driver/useDriverOverview';

export default function DashboardOverview() {
  const [user, setUser] = useState<{ email?: string; user_metadata?: { full_name?: string } } | null>(
    null
  );
  const { loading, pendingTasks, stats } = useDriverOverview();

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      setUser(authUser);
    };

    getUser();
  }, []);

  if (loading) {
    return <div className="p-8 text-blue-950">Loading your overview...</div>;
  }

  const firstName = user?.user_metadata?.full_name?.split(' ')[0] || 'Driver';
  const accountStatusClass =
    stats.accountStatusTone === 'green'
      ? 'text-green-600'
      : stats.accountStatusTone === 'red'
        ? 'text-red-600'
        : 'text-amber-600';

  return (
    <div>
      <div className="mb-8 flex items-center gap-4">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-blue-200 bg-blue-50">
          <div className="flex h-full w-full items-center justify-center text-xl text-blue-950">👤</div>
        </div>
        <div>
          <h1 className="text-3xl font-bold text-blue-950">Welcome back, {firstName}!</h1>
          <p className="mt-1 text-blue-950">Here&apos;s what&apos;s happening with your account today.</p>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="rounded-2xl border border-blue-200 bg-white p-6">
          <p className="text-sm text-blue-950">Documents Uploaded</p>
          <p className="mt-2 text-4xl font-bold text-blue-950">
            {stats.documentsUploaded} / {stats.documentsRequired}
          </p>
          <p className="mt-1 text-sm text-amber-600">
            {stats.documentsPending > 0
              ? `${stats.documentsPending} document${stats.documentsPending === 1 ? '' : 's'} still needed`
              : 'All required documents uploaded'}
          </p>
        </div>

        <div className="rounded-2xl border border-blue-200 bg-white p-6">
          <p className="text-sm text-blue-950">Account Status</p>
          <p className={`mt-2 text-4xl font-bold ${accountStatusClass}`}>{stats.accountStatusLabel}</p>
          <p className="mt-1 text-sm text-blue-950">
            {stats.profileCompletion}% profile complete
          </p>
        </div>

        <div className="rounded-2xl border border-blue-200 bg-white p-6">
          <p className="text-sm text-blue-950">Pending Actions</p>
          <p className="mt-2 text-4xl font-bold text-blue-950">{stats.pendingTaskCount}</p>
          <p className="mt-1 text-sm text-blue-950">
            {stats.pendingTaskCount === 1 ? 'Task to complete' : 'Tasks to complete'}
          </p>
        </div>
      </div>

      <div className="mb-8">
        <h2 className="mb-4 text-xl font-semibold text-blue-950">Quick Actions</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Link
            href="/dashboard/documents"
            className="block rounded-2xl border border-blue-200 bg-white p-6 transition hover:border-[#1E40AF]"
          >
            <div className="mb-1 text-lg font-semibold text-blue-950">Upload Documents</div>
            <p className="text-sm text-blue-950">Submit your required documents</p>
          </Link>

          <Link
            href="/dashboard/updates"
            className="block rounded-2xl border border-blue-200 bg-white p-6 transition hover:border-[#1E40AF]"
          >
            <div className="mb-1 text-lg font-semibold text-blue-950">View Company Updates</div>
            <p className="text-sm text-blue-950">Check the latest announcements</p>
          </Link>

          <Link
            href="/dashboard/profile"
            className="block rounded-2xl border border-blue-200 bg-white p-6 transition hover:border-[#1E40AF]"
          >
            <div className="mb-1 text-lg font-semibold text-blue-950">Update Profile</div>
            <p className="text-sm text-blue-950">Manage your information</p>
          </Link>
        </div>
      </div>

      <PendingTasksSection tasks={pendingTasks} />
    </div>
  );
}