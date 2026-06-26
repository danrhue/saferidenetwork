'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function OrganizationDashboard() {
  const [stats, setStats] = useState({
    totalTrips: 0,
    openTrips: 0,
    assignedTrips: 0,
    completedTrips: 0,
    totalOffers: 0,
  });
  const [loading, setLoading] = useState(true);
  const [recentTrips, setRecentTrips] = useState<any[]>([]);
  const [recentOffers, setRecentOffers] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: trips } = await supabase
        .from('trips')
        .select('id, title, status, created_at, pickup_location, dropoff_location, price')
        .eq('organization_id', user.id)
        .order('created_at', { ascending: false });

      const total = trips?.length || 0;
      const open = trips?.filter((t: any) => t.status === 'open').length || 0;
      const assigned = trips?.filter((t: any) => t.status === 'assigned').length || 0;
      const completed = trips?.filter((t: any) => t.status === 'completed').length || 0;

      setRecentTrips((trips || []).slice(0, 5));

      const { data: offers } = await supabase
        .from('trip_offers')
        .select(`
          id, status, created_at, message,
          trips!inner (id, title, organization_id)
        `)
        .eq('trips.organization_id', user.id)
        .order('created_at', { ascending: false })
        .limit(6);

      setRecentOffers(offers || []);

      const { data: allOffers } = await supabase
        .from('trip_offers')
        .select('id, trips!inner(organization_id)')
        .eq('trips.organization_id', user.id);

      setStats({
        totalTrips: total,
        openTrips: open,
        assignedTrips: assigned,
        completedTrips: completed,
        totalOffers: allOffers?.length || 0,
      });

      setLoading(false);
    };

    fetchData();
  }, []);

  if (loading) {
    return <div className="p-8">Loading dashboard...</div>;
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-blue-950">Organization Dashboard</h1>
        <p className="text-blue-800 mt-1">Manage your trips and see driver activity at a glance.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <div className="text-sm text-blue-800">Total Trips</div>
          <div className="text-3xl font-bold text-blue-950 mt-1">{stats.totalTrips}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <div className="text-sm text-blue-800">Open for Offers</div>
          <div className="text-3xl font-bold text-green-600 mt-1">{stats.openTrips}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <div className="text-sm text-blue-800">Assigned</div>
          <div className="text-3xl font-bold text-blue-600 mt-1">{stats.assignedTrips}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <div className="text-sm text-blue-800">Completed</div>
          <div className="text-3xl font-bold text-purple-600 mt-1">{stats.completedTrips}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <div className="text-sm text-blue-800">Offers Received</div>
          <div className="text-3xl font-bold text-blue-950 mt-1">{stats.totalOffers}</div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4 text-blue-950">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link href="/organization/trips/new" className="block bg-[#1E3A8A] hover:bg-blue-900 text-white rounded-2xl p-6 transition">
            <div className="font-semibold text-lg">Post a New Trip</div>
            <p className="text-blue-100 text-sm mt-1">Create a trip and start receiving driver offers immediately.</p>
          </Link>
          <Link href="/organization/trips" className="block bg-white border border-gray-200 hover:border-blue-300 rounded-2xl p-6 transition">
            <div className="font-semibold text-lg text-blue-950">Review My Trips</div>
            <p className="text-blue-800 text-sm mt-1">See offers, approve drivers, and manage trip status.</p>
          </Link>
          <Link href="/organization/profile" className="block bg-white border border-gray-200 hover:border-blue-300 rounded-2xl p-6 transition">
            <div className="font-semibold text-lg text-blue-950">Update Organization Profile</div>
            <p className="text-blue-800 text-sm mt-1">Edit your name and organization details.</p>
          </Link>
          <Link href="/organization/active-trips" className="block bg-white border-2 border-blue-300 hover:border-[#1E3A8A] rounded-2xl p-6 transition">
            <div className="font-semibold text-lg text-blue-950">Live Driver Tracking</div>
            <p className="text-blue-800 text-sm mt-1">View real-time GPS locations for your assigned &amp; in-progress trips.</p>
          </Link>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <div className="flex justify-between mb-4">
            <h2 className="text-xl font-semibold text-blue-950">Recent Trips</h2>
            <Link href="/organization/trips" className="text-sm text-blue-900 hover:underline">All trips →</Link>
          </div>
          {recentTrips.length === 0 ? (
            <p className="text-blue-800 text-sm">No trips yet.</p>
          ) : (
            <div className="space-y-3">
              {recentTrips.map((trip) => (
                <Link key={trip.id} href="/organization/trips" className="block p-4 border border-gray-100 rounded-xl hover:bg-gray-50">
                  <div className="flex justify-between">
                    <div className="font-medium text-blue-950 truncate pr-2">{trip.title}</div>
                    <span className={`text-xs px-2 py-1 rounded font-medium self-start ${
                      trip.status === 'open' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-900'
                    }`}>{trip.status}</span>
                  </div>
                  <div className="text-xs text-blue-800 mt-1 truncate">{trip.pickup_location} → {trip.dropoff_location}</div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <div className="flex justify-between mb-4">
            <h2 className="text-xl font-semibold text-blue-950">Recent Offers</h2>
            <Link href="/organization/trips" className="text-sm text-blue-900 hover:underline">Manage →</Link>
          </div>
          {recentOffers.length === 0 ? (
            <p className="text-blue-800 text-sm">No offers received yet.</p>
          ) : (
            <div className="space-y-3">
              {recentOffers.map((offer: any) => (
                <div key={offer.id} className="p-4 border border-gray-100 rounded-xl">
                  <div className="font-medium text-blue-950 truncate">{offer.trips?.title}</div>
                  <div className="text-xs text-blue-800 mt-1 flex justify-between">
                    <span>Offer {new Date(offer.created_at).toLocaleDateString()}</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      offer.status === 'approved' ? 'bg-green-100 text-green-700' : 
                      offer.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>{offer.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
