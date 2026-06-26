'use client';

import { useCallback, useState } from 'react';
import type { SoftDeleteEntityType } from '@/lib/soft-delete';

type PendingDelete = {
  entityType: SoftDeleteEntityType;
  id: string;
  label: string;
};

export function useSoftDelete(onSuccess?: () => void) {
  const [pending, setPending] = useState<PendingDelete | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestDelete = useCallback((item: PendingDelete) => {
    setError(null);
    setPending(item);
  }, []);

  const cancelDelete = useCallback(() => {
    if (!loading) setPending(null);
  }, [loading]);

  const confirmDelete = useCallback(async () => {
    if (!pending) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/soft-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityType: pending.entityType,
          id: pending.id,
          action: 'soft_delete',
          metadata: { label: pending.label },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Delete failed');
      }

      setPending(null);
      onSuccess?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setLoading(false);
    }
  }, [pending, onSuccess]);

  const restore = useCallback(
    async (entityType: SoftDeleteEntityType, id: string) => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch('/api/admin/soft-delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entityType, id, action: 'restore' }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Restore failed');
        }

        onSuccess?.();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Restore failed');
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [onSuccess]
  );

  return {
    pending,
    loading,
    error,
    requestDelete,
    cancelDelete,
    confirmDelete,
    restore,
    clearError: () => setError(null),
  };
}