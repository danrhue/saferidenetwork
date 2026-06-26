'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import ActiveTripsMap from '../../components/ActiveTripsMap';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import SoftDeleteConfirmModal from '@/components/admin/SoftDeleteConfirmModal';
import { useSoftDelete } from '@/lib/admin/use-soft-delete';

interface ActiveTrip {
  id: string;
  title: string;
  pickup_location: string;
  dropoff_location: string;
  pickup_time: string;
  status: string;
  assigned_driver_id: string | null;
  organization_id: string;
  current_lat: number | null;
  current_lng: number | null;
  last_location_update: string | null;
  started_at: string | null;
  organization_name?: string;
  driver_name?: string;
}

export default function AdminActiveTrips() {
  const router = useRouter();
  const [trips, setTrips] = useState<ActiveTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'assigned' | 'in_progress'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [tick, setTick] = useState(0); // forces periodic re-render for live durations

  const fetchActiveTrips = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/trips', { cache: 'no-store' });
      const tripsData = await res.json();
      if (!res.ok) {
        console.error(tripsData.error);
        setLoading(false);
        return;
      }

      const activeTrips: ActiveTrip[] = (Array.isArray(tripsData) ? tripsData : [])
        .filter((t: ActiveTrip) => ['assigned', 'in_progress'].includes(t.status))
        .sort(
          (a: ActiveTrip, b: ActiveTrip) =>
            new Date(a.pickup_time).getTime() - new Date(b.pickup_time).getTime()
        );

      setTrips(activeTrips);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const softDelete = useSoftDelete(fetchActiveTrips);

  useEffect(() => {
    fetchActiveTrips();
  }, [fetchActiveTrips, router]);

  // Periodic tick for live duration displays in list
  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(iv);
  }, []);

  // Real-time updates for the active trips list (Supabase Realtime)
  useEffect(() => {
    const channel = supabase
      .channel('admin-active-trips-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'trips',
        },
        (payload) => {
          const newRec = payload.new as any;
          const oldRec = payload.old as any;
          const newStatus = newRec?.status;
          const oldStatus = oldRec?.status;

          // Refresh if status changed to/from active states
          const activeStatuses = ['assigned', 'in_progress'];
          if (
            (activeStatuses.includes(newStatus) || activeStatuses.includes(oldStatus)) ||
            (payload.eventType === 'INSERT' && activeStatuses.includes(newStatus))
          ) {
            fetchActiveTrips();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  // Client-side filtering
  const filteredTrips = trips.filter(trip => {
    const matchesStatus = statusFilter === 'all' || trip.status === statusFilter;
    const term = searchTerm.toLowerCase();
    const matchesSearch = !term ||
      trip.title.toLowerCase().includes(term) ||
      (trip.organization_name || '').toLowerCase().includes(term) ||
      (trip.driver_name || '').toLowerCase().includes(term) ||
      trip.pickup_location.toLowerCase().includes(term) ||
      trip.dropoff_location.toLowerCase().includes(term);
    return matchesStatus && matchesSearch;
  });

  const getStatusBadge = (status: string) => {
    if (status === 'in_progress') {
      return 'bg-blue-100 text-blue-800';
    }
    return 'bg-blue-50 text-blue-700';
  };

  const formatLastUpdate = (iso: string | null) => {
    if (!iso) return 'No data';
    const date = new Date(iso);
    const diffMs = Date.now() - date.getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
  };

  const getTripDuration = (startedAt: string | null, status: string) => {
    if (status !== 'in_progress' || !startedAt) return null;
    const start = new Date(startedAt).getTime();
    const diffMs = Date.now() - start;
    const mins = Math.floor(diffMs / 60000);
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    return hrs > 0 ? `${hrs}h ${rem}m` : `${rem}m`;
  };

  if (loading) {
    return <div className="text-blue-800">Loading all active trips...</div>;
  }

  return (
    <div>
        <AdminPageHeader
          title="Live Trips"
          subtitle="Platform-wide live trip monitoring"
        />

        <div className="mb-6">
          <div className="flex items-baseline justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-semibold text-blue-950 tracking-[-0.5px]">Active Trips</h2>
                <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[10px] font-semibold tracking-[0.75px] text-emerald-700">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> LIVE OPERATIONS
                </div>
              </div>
              <p className="mt-1 text-[15px] text-blue-700">Real-time positions and historical trails for all assigned and in-progress trips across the platform.</p>
            </div>
            <div className="hidden md:flex items-center gap-2 text-sm">
              <span className="font-semibold text-blue-800 tabular-nums">{filteredTrips.length}</span>
              <span className="text-blue-700/70">active</span>
            </div>
          </div>
        </div>

        {/* Advanced clustered map hero — elevated as primary visualization for monitoring many trips */}
        {(() => {
          const mappable = filteredTrips.filter(t => t.current_lat != null && t.current_lng != null);
          return mappable.length > 0 ? (
            <div className="mb-7">
              <div className="flex items-center justify-between mb-1.5 px-0.5">
                <div className="text-[10px] font-semibold tracking-[0.6px] text-blue-900/70">CLUSTERED LIVE POSITIONS • AUTO-GROUPS NEARBY TRIPS</div>
                <div className="text-[10px] text-blue-700/60 font-medium">{mappable.length} with GPS</div>
              </div>
              <ActiveTripsMap trips={mappable.map(t => ({
                id: t.id,
                title: t.title,
                status: t.status,
                current_lat: t.current_lat!,
                current_lng: t.current_lng!,
                driver_name: t.driver_name,
                organization_name: t.organization_name,
              }))} height={428} />
            </div>
          ) : null;
        })()}

        {/* Filters — refined, premium toolbar */}
        <div className="mb-6 flex flex-col sm:flex-row gap-3 items-center bg-white border border-blue-200 rounded-3xl p-2.5 shadow-sm">
          <div className="flex gap-1 text-sm px-1 font-medium">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-4 py-1.5 rounded-2xl text-sm transition ${statusFilter === 'all' ? 'bg-[#1E3A8A] text-white font-semibold shadow-sm' : 'text-blue-700 hover:text-blue-900 hover:bg-blue-100/70'}`}
            >
              All Active
            </button>
            <button
              onClick={() => setStatusFilter('assigned')}
              className={`px-4 py-1.5 rounded-2xl text-sm transition ${statusFilter === 'assigned' ? 'bg-[#1E3A8A] text-white font-semibold shadow-sm' : 'text-blue-700 hover:text-blue-900 hover:bg-blue-100/70'}`}
            >
              Assigned
            </button>
            <button
              onClick={() => setStatusFilter('in_progress')}
              className={`px-4 py-1.5 rounded-2xl text-sm transition ${statusFilter === 'in_progress' ? 'bg-[#1E3A8A] text-white font-semibold shadow-sm' : 'text-blue-700 hover:text-blue-900 hover:bg-blue-100/70'}`}
            >
              In Progress
            </button>
          </div>

          <div className="flex-1 w-full sm:w-auto px-1">
            <input
              type="text"
              placeholder="Search trips, organizations, or drivers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full border border-blue-200 focus:border-[#1E3A8A] rounded-2xl px-4 py-2 text-sm placeholder:text-blue-400/60 focus:outline-none bg-white"
            />
          </div>
        </div>

        {filteredTrips.length === 0 ? (
          <div className="bg-white border border-blue-200 rounded-3xl p-14 text-center shadow-sm">
            <div className="mx-auto w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-4">
              <span className="text-blue-600 text-xl">◌</span>
            </div>
            <p className="text-xl font-semibold text-blue-950">No active trips match your filters.</p>
            <p className="text-sm text-blue-700/70 mt-1.5 max-w-xs mx-auto">Adjust filters or search to see assigned and in-progress operations.</p>
          </div>
        ) : (
          <div className="space-y-3.5">
            {filteredTrips.map((trip) => (
              <div 
                key={trip.id} 
                className="bg-white border border-blue-200 rounded-3xl p-6 shadow-sm hover:shadow-lg hover:border-blue-300 transition-all duration-200 group"
              >
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-3.5">
                      <span className="font-semibold text-[20px] leading-tight text-blue-950 group-hover:text-[#1E3A8A] transition-colors tracking-[-0.2px]">
                        {trip.title}
                      </span>
                      <span className={`inline-flex items-center px-3 py-px text-[10px] font-semibold rounded-full border tracking-wider ${getStatusBadge(trip.status)}`}>
                        {trip.status === 'in_progress' ? 'IN PROGRESS' : 'ASSIGNED'}
                      </span>
                      {getTripDuration(trip.started_at, trip.status) && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 rounded-full py-px">
                          {getTripDuration(trip.started_at, trip.status)} ELAPSED
                        </span>
                      )}
                    </div>

                    <div className="text-[15px] font-medium text-slate-700 mb-4 tracking-tight">
                      {trip.pickup_location} <span className="text-[#1E3A8A] font-semibold">→</span> {trip.dropoff_location}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-7 gap-y-2 text-[13.5px]">
                      <div className="text-blue-900"><span className="text-blue-900/60 text-[10px] font-semibold tracking-[0.75px] block mb-px">ORGANIZATION</span> <span className="text-blue-950 font-semibold">{trip.organization_name || 'Unknown'}</span></div>
                      <div className="text-blue-900"><span className="text-blue-900/60 text-[10px] font-semibold tracking-[0.75px] block mb-px">DRIVER</span> <span className="text-blue-950 font-semibold">{trip.driver_name || 'Unassigned'}</span></div>
                      <div className="text-blue-900"><span className="text-blue-900/60 text-[10px] font-semibold tracking-[0.75px] block mb-px">SCHEDULED PICKUP</span> <span className="text-blue-950 font-semibold">{new Date(trip.pickup_time).toLocaleString([], {month:'short', day:'numeric', hour:'numeric', minute:'2-digit'})}</span></div>
                      <div className="text-blue-900"><span className="text-blue-900/60 text-[10px] font-semibold tracking-[0.75px] block mb-px">LAST GPS UPDATE</span> <span className="text-blue-950 font-semibold">{formatLastUpdate(trip.last_location_update)}</span></div>
                    </div>
                  </div>

                  <div className="flex-shrink-0 space-y-2 pt-1 lg:pt-1.5 lg:text-right">
                    <Link
                      href={`/admin/active-trips/${trip.id}`}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#1E3A8A] px-7 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#162D6B] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/40 focus:ring-offset-2 active:bg-blue-900"
                    >
                      MONITOR LIVE MAP
                    </Link>
                    <div>
                      <button
                        type="button"
                        onClick={() =>
                          softDelete.requestDelete({
                            entityType: 'trip',
                            id: trip.id,
                            label: trip.title,
                          })
                        }
                        className="inline-flex items-center justify-center rounded-2xl bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-700"
                      >
                        Delete Trip
                      </button>
                    </div>
                    <div className="text-[9.5px] font-semibold tracking-[0.8px] text-blue-600/60">
                      REAL-TIME GPS + FULL TRAIL
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 text-center text-[10px] font-medium tracking-[1px] text-blue-700/50">
          SECURE READ-ONLY OPERATIONS MONITORING • REALTIME UPDATES VIA SUPABASE
        </div>

      <SoftDeleteConfirmModal
        open={Boolean(softDelete.pending)}
        title="Delete trip?"
        description="This live trip will be soft-deleted and hidden from all portals."
        entityLabel={softDelete.pending?.label ?? ''}
        loading={softDelete.loading}
        onConfirm={softDelete.confirmDelete}
        onCancel={softDelete.cancelDelete}
      />
    </div>
  );
}
