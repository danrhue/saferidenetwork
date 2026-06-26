'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { calculateDriverCompletion } from '@/lib/driver/onboarding-completion';
import type { RequiredDocument } from '@/lib/driver/required-documents';

export function useProfileCompletion() {
  const [profileCompletion, setProfileCompletion] = useState(0);
  const [documentsApproved, setDocumentsApproved] = useState(0);
  const [totalDocuments, setTotalDocuments] = useState(0);

  const refresh = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    let docs: { document_type: string; status: string }[] = [];
    let required: RequiredDocument[] = [];

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
      }
    } catch {
      // Sidebar badge can stay at 0 if fetch fails
    }

    const uploadableRequired = required.filter((d) => d.uploadable).length;
    const uploadedTypes = new Set(docs.map((d) => d.document_type)).size;
    const approvedTypes = new Set(
      docs.filter((d) => d.status === 'approved').map((d) => d.document_type)
    ).size;

    setProfileCompletion(
      calculateDriverCompletion(profile ?? {}, {
        documentsUploaded: uploadedTypes,
        documentsRequired: uploadableRequired,
      })
    );
    setDocumentsApproved(approvedTypes);
    setTotalDocuments(required.length);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { profileCompletion, documentsApproved, totalDocuments, refresh };
}