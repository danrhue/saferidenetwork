'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { calculateDriverCompletion } from '@/lib/driver/onboarding-completion';
import {
  calculateDriverOverviewStats,
  calculatePendingTasks,
  type DriverDocumentRecord,
  type DriverOverviewStats,
  type PendingTask,
} from '@/lib/driver/pending-tasks';
import type { RequiredDocument } from '@/lib/driver/required-documents';

export function useDriverOverview() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Record<string, unknown>>({});
  const [documents, setDocuments] = useState<DriverDocumentRecord[]>([]);
  const [requiredDocuments, setRequiredDocuments] = useState<RequiredDocument[]>([]);
  const [drivingStates, setDrivingStates] = useState<string[]>([]);
  const [pendingTasks, setPendingTasks] = useState<PendingTask[]>([]);
  const [stats, setStats] = useState<DriverOverviewStats>({
    documentsUploaded: 0,
    documentsRequired: 0,
    documentsApproved: 0,
    documentsPending: 0,
    profileCompletion: 0,
    pendingTaskCount: 0,
    accountStatusLabel: 'Loading',
    accountStatusTone: 'yellow',
  });

  const refresh = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    const { data: profileRow } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    const profileData: Record<string, unknown> = profileRow
      ? {
          ...profileRow,
          email: profileRow.email || user.email || '',
          mailing_same_as_physical: profileRow.mailing_same_as_physical !== false,
        }
      : { email: user.email || '', mailing_same_as_physical: true };

    let docs: DriverDocumentRecord[] = [];
    let required: RequiredDocument[] = [];
    let states: string[] = [];

    try {
      const [docsRes, reqRes] = await Promise.all([
        fetch('/api/driver/documents', { cache: 'no-store' }),
        fetch('/api/driver/required-documents', { cache: 'no-store' }),
      ]);

      if (docsRes.ok) {
        const data = await docsRes.json();
        docs = Array.isArray(data) ? data : [];
      }

      if (reqRes.ok) {
        const data = await reqRes.json();
        required = Array.isArray(data.documents) ? data.documents : [];
        states = Array.isArray(data.drivingStates) ? data.drivingStates : [];
      }
    } catch {
      // Partial data is acceptable for overview rendering
    }

    const uploadableRequired = required.filter((d) => d.uploadable).length;
    const uploadedTypes = new Set(docs.map((d) => d.document_type)).size;
    const profileCompletion = calculateDriverCompletion(profileData, {
      documentsUploaded: uploadedTypes,
      documentsRequired: uploadableRequired,
    });

    const tasks = calculatePendingTasks(profileData, docs, required);
    const overviewStats = calculateDriverOverviewStats(
      profileData,
      docs,
      profileCompletion,
      required
    );

    setProfile(profileData);
    setDocuments(docs);
    setRequiredDocuments(required);
    setDrivingStates(states);
    setPendingTasks(tasks);
    setStats(overviewStats);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    loading,
    profile,
    documents,
    requiredDocuments,
    drivingStates,
    pendingTasks,
    stats,
    refresh,
  };
}