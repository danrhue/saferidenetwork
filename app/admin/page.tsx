'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface AdminStats {
  totalDrivers: number;
  pendingDocuments: number;
  activeTrips: number;
  totalUsers: number;
  totalOrganizations: number;
  pendingSeating: number;
}

interface DriverRow {
  id: string;
  full_name: string | null;
  phone: string | null;
  created_at: string;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats>({
    totalDrivers: 0,
    pendingDocuments: 0,
    activeTrips: 0,
    totalUsers: 0,
    totalOrganizations: 0,
    pendingSeating: 0,
  });
  const [recentDrivers, setRecentDrivers] = useState<DriverRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [statsRes, driversRes] = await Promise.all([
          fetch('/api/admin/stats', { cache: 'no-store' }),
          fetch('/api/admin/drivers', { cache: 'no-store' }),
        ]);

        if (statsRes.ok) {
          setStats(await statsRes.json());
        }

        if (driversRes.ok) {
          const drivers = await driversRes.json();
          if (Array.isArray(drivers)) {
            const sorted = [...drivers].sort((a, b) => {
              const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
              const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
              return bTime - aTime;
            });
            setRecentDrivers(sorted.slice(0, 5));
          }
        }
      } catch (error) {
        console.error('Failed to load admin dashboard:', error);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  if (loading) {
    return <div className="text-blue-800">Loading dashboard...</div>;
  }

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold text-blue-950">Admin Dashboard</h1>
          <p className="text-blue-800 mt-1">Welcome back — here&apos;s what&apos;s happening today.</p>
        </div>
        <div className="text-sm text-blue-800">
          <div className="text-blue-600">Last updated</div>
          <div className="font-medium">{new Date().toLocaleDateString()}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-10">
        <div className="bg-white border border-blue-100 rounded-2xl p-6 shadow-sm">
          <div className="text-sm text-blue-800">Total Drivers</div>
          <div className="text-4xl font-bold text-blue-950 mt-2">{stats.totalDrivers}</div>
        </div>
        <div className="bg-white border border-blue-100 rounded-2xl p-6 shadow-sm">
          <div className="text-sm text-blue-800">Pending Document Reviews</div>
          <div className="text-4xl font-bold text-orange-600 mt-2">{stats.pendingDocuments}</div>
        </div>
        <div className="bg-white border border-blue-100 rounded-2xl p-6 shadow-sm">
          <div className="text-sm text-blue-800">Active Trips</div>
          <div className="text-4xl font-bold text-green-600 mt-2">{stats.activeTrips}</div>
        </div>
        <div className="bg-white border border-blue-100 rounded-2xl p-6 shadow-sm">
          <div className="text-sm text-blue-800">Total Users</div>
          <div className="text-4xl font-bold text-blue-950 mt-2">{stats.totalUsers}</div>
        </div>
      </div>

      <div className="mb-10">
        <h2 className="font-semibold text-xl text-blue-950 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link href="/admin/documents" className="block p-5 bg-white border border-blue-100 rounded-2xl hover:border-[#1E3A8A] transition shadow-sm">
            <div className="font-medium text-blue-950">Review Documents</div>
            <div className="text-sm text-blue-800 mt-1">{stats.pendingDocuments} awaiting review</div>
          </Link>
          <Link href="/admin/drivers" className="block p-5 bg-white border border-blue-100 rounded-2xl hover:border-[#1E3A8A] transition shadow-sm">
            <div className="font-medium text-blue-950">Manage Drivers</div>
            <div className="text-sm text-blue-800 mt-1">{stats.totalDrivers} registered</div>
          </Link>
          <Link href="/admin/active-trips" className="block p-5 bg-white border border-blue-100 rounded-2xl hover:border-[#1E3A8A] transition shadow-sm">
            <div className="font-medium text-blue-950">Live Trips</div>
            <div className="text-sm text-blue-800 mt-1">{stats.activeTrips} in progress</div>
          </Link>
          <Link href="/admin/seating-approvals" className="block p-5 bg-white border border-blue-100 rounded-2xl hover:border-[#1E3A8A] transition shadow-sm">
            <div className="font-medium text-blue-950">Seating Review</div>
            <div className="text-sm text-blue-800 mt-1">{stats.pendingSeating} pending</div>
          </Link>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-xl text-blue-950">Recent Drivers</h2>
          <Link href="/admin/drivers" className="text-sm text-[#1E3A8A] hover:underline">
            View all →
          </Link>
        </div>
        <div className="bg-white border border-blue-100 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead className="bg-blue-50">
                <tr>
                  <th className="text-left p-4 text-sm font-semibold text-blue-950">Name</th>
                  <th className="text-left p-4 text-sm font-semibold text-blue-950">Phone</th>
                  <th className="text-left p-4 text-sm font-semibold text-blue-950">Joined</th>
                  <th className="text-left p-4 text-sm font-semibold text-blue-950">Action</th>
                </tr>
              </thead>
              <tbody>
                {recentDrivers.length > 0 ? (
                  recentDrivers.map((driver) => (
                    <tr key={driver.id} className="border-t border-blue-50">
                      <td className="p-4 text-blue-950">{driver.full_name || 'Unnamed Driver'}</td>
                      <td className="p-4 text-blue-800">{driver.phone || '—'}</td>
                      <td className="p-4 text-sm text-blue-700">
                        {new Date(driver.created_at).toLocaleDateString()}
                      </td>
                      <td className="p-4">
                        <Link
                          href={`/admin/documents?driverId=${driver.id}`}
                          className="text-[#1E3A8A] hover:underline text-sm font-medium"
                        >
                          View Documents
                        </Link>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-blue-700">
                      No drivers found yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}