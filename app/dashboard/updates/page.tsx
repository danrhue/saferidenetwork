'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface Update {
  id: string;
  title: string;
  content: string;
  created_at: string;
}

export default function CompanyUpdates() {
  const [updates, setUpdates] = useState<Update[]>([]);
  const [viewedUpdateIds, setViewedUpdateIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAsRead, setMarkingAsRead] = useState(false);

  const unreadCount = updates.filter(
    (update) => !viewedUpdateIds.includes(update.id)
  ).length;

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: updatesData } = await supabase
        .from('company_updates')
        .select('*')
        .order('created_at', { ascending: false });

      const { data: viewsData } = await supabase
        .from('user_update_views')
        .select('update_id')
        .eq('user_id', user.id);

      const viewedIds = viewsData?.map((v) => v.update_id) || [];

      setUpdates(updatesData || []);
      setViewedUpdateIds(viewedIds);
      setLoading(false);
    };

    fetchData();
  }, []);

  // Real-time subscription for new updates
  useEffect(() => {
    const channel = supabase
      .channel('company-updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'company_updates',
        },
        (payload) => {
          const newUpdate = payload.new as Update;
          setUpdates((prev) => [newUpdate, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const shouldShowNewBadge = (updateId: string) => {
    return !viewedUpdateIds.includes(updateId);
  };

  // Mark a single update as read
  const markAsRead = async (updateId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      await supabase.from('user_update_views').insert({
        user_id: user.id,
        update_id: updateId,
      });

      setViewedUpdateIds((prev) => [...prev, updateId]);
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  // Mark all unread updates as read
  const handleMarkAllAsRead = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || unreadCount === 0) return;

    setMarkingAsRead(true);

    try {
      const unreadUpdates = updates.filter(
        (update) => !viewedUpdateIds.includes(update.id)
      );

      const records = unreadUpdates.map((update) => ({
        user_id: user.id,
        update_id: update.id,
      }));

      const { error } = await supabase.from('user_update_views').insert(records);
      if (error) throw error;

      const newViewedIds = [
        ...viewedUpdateIds,
        ...unreadUpdates.map((u) => u.id),
      ];
      setViewedUpdateIds(newViewedIds);
    } catch (error) {
      alert('Failed to mark updates as read.');
    } finally {
      setMarkingAsRead(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-blue-950">Loading updates...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-blue-950">Company Updates</h1>
          <p className="text-blue-950">
            Latest news and announcements from Safe Ride Network.
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllAsRead}
            disabled={markingAsRead}
            className="px-5 py-2.5 bg-[#1E3A8A] hover:bg-blue-900 text-white rounded-xl text-sm font-medium disabled:opacity-70"
          >
            {markingAsRead 
              ? 'Marking as read...' 
              : `Mark all as read (${unreadCount})`
            }
          </button>
        )}
      </div>

      {updates.length === 0 ? (
        <div className="bg-white border rounded-2xl p-12 text-center">
          <h3 className="text-xl font-semibold mb-2 text-blue-950">No updates yet</h3>
          <p className="text-blue-950">Important announcements will appear here.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {updates.map((update) => {
            const showNew = shouldShowNewBadge(update.id);

            return (
              <div key={update.id} className="bg-white border rounded-2xl p-6">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-semibold text-blue-950">{update.title}</h2>
                    {showNew && (
                      <span className="px-3 py-1 text-xs font-semibold bg-green-100 text-green-700 rounded-full">
                        NEW
                      </span>
                    )}
                  </div>
                  <span className="text-sm text-blue-950 whitespace-nowrap">
                    {new Date(update.created_at).toLocaleDateString()}
                  </span>
                </div>

                <div className="prose max-w-none text-blue-950 whitespace-pre-line mb-4">
                  {update.content}
                </div>

                {showNew && (
                  <button
                    onClick={() => markAsRead(update.id)}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Mark as read
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
