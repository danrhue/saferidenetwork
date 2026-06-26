'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { supabase } from '@/lib/supabase';
import {
  getIncompleteOfferRequirements,
  type IncompleteOfferRequirement,
} from '@/lib/driver/incomplete-requirements';
import {
  countApprovedRequiredDocuments,
  countRequiredUploadSlots,
} from '@/lib/driver/document-completion';
import {
  buildDocumentCompletionContext,
  getDriverCompletionPercent,
  getIncompleteWizardSteps,
  type IncompleteWizardStep,
} from '@/lib/driver/profile-completion';
import type { WizardCompletionContext } from '@/lib/driver/wizard-steps';
import type { RequiredDocument } from '@/lib/driver/required-documents';

type ProfileCompletionContextValue = {
  profileCompletion: number;
  isProfileComplete: boolean;
  incompleteSteps: IncompleteWizardStep[];
  incompleteRequirements: IncompleteOfferRequirement[];
  documentsApproved: number;
  totalDocuments: number;
  documentContext: WizardCompletionContext;
  refresh: () => Promise<void>;
};

const ProfileCompletionContext = createContext<ProfileCompletionContextValue | null>(
  null
);

export function ProfileCompletionProvider({ children }: { children: ReactNode }) {
  const [profileCompletion, setProfileCompletion] = useState(0);
  const [documentsApproved, setDocumentsApproved] = useState(0);
  const [totalDocuments, setTotalDocuments] = useState(0);
  const [documentContext, setDocumentContext] = useState<WizardCompletionContext>({
    documentsUploaded: 0,
    documentsRequired: 0,
  });
  const [incompleteSteps, setIncompleteSteps] = useState<IncompleteWizardStep[]>([]);
  const [incompleteRequirements, setIncompleteRequirements] = useState<
    IncompleteOfferRequirement[]
  >([]);

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

    const profileData = profile
      ? {
          ...profile,
          email: profile.email || user.email || '',
          mailing_same_as_physical: profile.mailing_same_as_physical !== false,
        }
      : { email: user.email || '', mailing_same_as_physical: true };

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
      // Badges can stay at last known values if fetch fails.
    }

    const ctx = buildDocumentCompletionContext(docs, required);
    const percent = getDriverCompletionPercent(profileData, ctx);

    setDocumentContext(ctx);
    setProfileCompletion(percent);
    setIncompleteSteps(getIncompleteWizardSteps(profileData, ctx));
    setIncompleteRequirements(
      getIncompleteOfferRequirements(profileData, ctx, {
        requiredDocuments: required,
        driverDocuments: docs,
      })
    );
    setDocumentsApproved(countApprovedRequiredDocuments(docs, required));
    setTotalDocuments(countRequiredUploadSlots(required));
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({
      profileCompletion,
      isProfileComplete: profileCompletion === 100,
      incompleteSteps,
      incompleteRequirements,
      documentsApproved,
      totalDocuments,
      documentContext,
      refresh,
    }),
    [
      profileCompletion,
      incompleteSteps,
      incompleteRequirements,
      documentsApproved,
      totalDocuments,
      documentContext,
      refresh,
    ]
  );

  return (
    <ProfileCompletionContext.Provider value={value}>
      {children}
    </ProfileCompletionContext.Provider>
  );
}

export function useProfileCompletion(): ProfileCompletionContextValue {
  const context = useContext(ProfileCompletionContext);
  if (!context) {
    throw new Error('useProfileCompletion must be used within ProfileCompletionProvider');
  }
  return context;
}