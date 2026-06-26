'use client';

import { useCallback, useEffect, useState } from 'react';
import type { RequiredDocument } from '@/lib/driver/required-documents';

type RequiredDocumentsResponse = {
  drivingStates: string[];
  documents: RequiredDocument[];
  message?: string;
  error?: string;
};

export function useRequiredDriverDocuments() {
  const [loading, setLoading] = useState(true);
  const [drivingStates, setDrivingStates] = useState<string[]>([]);
  const [documents, setDocuments] = useState<RequiredDocument[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/driver/required-documents', { cache: 'no-store' });
      const data = (await res.json()) as RequiredDocumentsResponse;

      if (!res.ok) {
        setError(data.error || 'Failed to load required documents.');
        setDocuments([]);
        setDrivingStates([]);
        setMessage(null);
        return;
      }

      setDrivingStates(data.drivingStates ?? []);
      setDocuments(Array.isArray(data.documents) ? data.documents : []);
      setMessage(data.message ?? null);
    } catch {
      setError('Failed to load required documents.');
      setDocuments([]);
      setDrivingStates([]);
      setMessage(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const uploadableDocuments = documents.filter((d) => d.uploadable);

  return {
    loading,
    drivingStates,
    documents,
    uploadableDocuments,
    message,
    error,
    refresh,
  };
}