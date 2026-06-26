'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';
import DrivingStateMultiSelect from '@/components/driver/DrivingStateMultiSelect';
import InlineToast from '@/components/ui/InlineToast';
import { refreshRequiredDocumentsClient } from '@/lib/driver/refresh-required-documents';
import type { WizardStepSaveResult } from '@/lib/driver/wizard-step-save';
import { formatStateList, normalizeStateCodes } from '@/lib/driver/us-states';

export type OperatingStatesSaveResult = {
  drivingStates: string[];
  requiredDocumentCount: number;
};

export type OperatingStatesStepHandle = {
  getDraftStates: () => string[];
  save: (options?: { requireStates?: boolean }) => Promise<WizardStepSaveResult>;
};

type OperatingStatesStepProps = {
  initialStates?: string[];
  onSaved?: (result: OperatingStatesSaveResult) => void | Promise<void>;
  onDirtyChange?: (dirty: boolean) => void;
  variant?: 'wizard' | 'card';
};

function statesEqual(a: string[], b: string[]): boolean {
  const left = normalizeStateCodes(a).join(',');
  const right = normalizeStateCodes(b).join(',');
  return left === right;
}

const OperatingStatesStep = forwardRef<OperatingStatesStepHandle, OperatingStatesStepProps>(
  function OperatingStatesStep(
    { initialStates = [], onSaved, onDirtyChange, variant = 'wizard' },
    ref
  ) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draftStates, setDraftStates] = useState<string[]>(normalizeStateCodes(initialStates));
  const [savedStates, setSavedStates] = useState<string[]>(normalizeStateCodes(initialStates));
  const [requiredDocumentCount, setRequiredDocumentCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);

  const isDirty = useMemo(
    () => !statesEqual(draftStates, savedStates),
    [draftStates, savedStates]
  );

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const loadStates = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/driver/driving-states', { cache: 'no-store' });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to load operating states.');
      }

      const fromApi = normalizeStateCodes(data.drivingStates);
      const merged =
        fromApi.length > 0 ? fromApi : normalizeStateCodes(initialStates);

      setDraftStates(merged);
      setSavedStates(merged);

      if (merged.length > 0) {
        try {
          const refreshed = await refreshRequiredDocumentsClient();
          setRequiredDocumentCount(refreshed.documentCount);
        } catch {
          setRequiredDocumentCount(null);
        }
      } else {
        setRequiredDocumentCount(null);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load operating states.';
      setError(message);
      const fallback = normalizeStateCodes(initialStates);
      setDraftStates(fallback);
      setSavedStates(fallback);
    } finally {
      setLoading(false);
    }
  }, [initialStates]);

  useEffect(() => {
    loadStates();
  }, [loadStates]);

  const persistStates = useCallback(
    async (options?: { requireStates?: boolean }): Promise<WizardStepSaveResult> => {
      const requireStates = options?.requireStates ?? true;

      if (draftStates.length === 0) {
        if (!requireStates) {
          return { ok: true };
        }
        const message = 'Select at least one state where you plan to drive.';
        setError(message);
        return { ok: false, error: message };
      }

      if (!isDirty && savedStates.length > 0) {
        return { ok: true };
      }

      setSaving(true);
      setError(null);
      setToast(null);

      try {
        const res = await fetch('/api/driver/driving-states', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ drivingStates: draftStates }),
        });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Failed to save operating states.');
        }

        const saved = normalizeStateCodes(data.drivingStates);
        setDraftStates(saved);
        setSavedStates(saved);

        let docCount = Number(data.requiredDocumentCount) || 0;
        try {
          const refreshed = await refreshRequiredDocumentsClient();
          docCount = refreshed.documentCount;
        } catch {
          // PATCH count is acceptable fallback
        }

        setRequiredDocumentCount(docCount);

        const result: OperatingStatesSaveResult = {
          drivingStates: saved,
          requiredDocumentCount: docCount,
        };

        await onSaved?.(result);

        if (variant === 'card') {
          setToast({
            tone: 'success',
            message: `Operating states saved (${formatStateList(saved)}). ${docCount} required document${docCount === 1 ? '' : 's'} now apply.`,
          });
        }

        return { ok: true };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to save operating states.';
        setError(message);
        if (variant === 'card') {
          setToast({ tone: 'error', message });
        }
        return { ok: false, error: message };
      } finally {
        setSaving(false);
      }
    },
    [draftStates, isDirty, onSaved, savedStates.length, variant]
  );

  useImperativeHandle(
    ref,
    () => ({
      getDraftStates: () => normalizeStateCodes(draftStates),
      save: persistStates,
    }),
    [draftStates, persistStates]
  );

  const save = () => {
    void persistStates({ requireStates: true });
  };

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading operating states">
        <div className="h-6 w-48 animate-pulse rounded-lg bg-blue-100" />
        <div className="h-12 animate-pulse rounded-xl bg-blue-50" />
        <div className="h-52 animate-pulse rounded-xl bg-blue-50" />
        <p className="text-sm text-blue-800/70">Loading your operating states...</p>
      </div>
    );
  }

  return (
    <>
      <div className={variant === 'card' ? 'rounded-2xl border border-blue-200 bg-white p-6' : ''}>
        {variant === 'wizard' && (
          <div className="mb-5">
            <h2 className="text-2xl font-semibold text-blue-950">Where will you drive?</h2>
            <p className="mt-1 text-sm text-blue-800">
              Required documents are determined by the states you select. You can update this
              anytime in your profile.
            </p>
          </div>
        )}

        {variant === 'card' && (
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-blue-950">Operating States</h2>
            <p className="mt-1 text-sm text-blue-800">
              Saved for: <span className="font-medium">{formatStateList(savedStates)}</span>
              {requiredDocumentCount != null && (
                <span className="text-blue-700/80">
                  {' '}
                  · {requiredDocumentCount} required document
                  {requiredDocumentCount === 1 ? '' : 's'}
                </span>
              )}
            </p>
          </div>
        )}

        <DrivingStateMultiSelect
          value={draftStates}
          onChange={setDraftStates}
          disabled={saving}
        />

        {variant === 'card' ? (
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={save}
              disabled={saving || draftStates.length === 0 || (!isDirty && savedStates.length > 0)}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#1E3A8A] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#162D6B] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Saving...
                </span>
              ) : isDirty || savedStates.length === 0 ? (
                'Save Operating States'
              ) : (
                'Saved'
              )}
            </button>

            {isDirty && (
              <span className="text-sm text-amber-700">You have unsaved changes.</span>
            )}
            {!isDirty && savedStates.length > 0 && requiredDocumentCount != null && (
              <span className="text-sm text-emerald-700">
                {requiredDocumentCount} document{requiredDocumentCount === 1 ? '' : 's'} required for
                your states.
              </span>
            )}
          </div>
        ) : (
          <div className="mt-5 space-y-2">
            {isDirty && (
              <p className="text-sm text-amber-700">
                Your selections will be saved when you continue to the next step.
              </p>
            )}
            {savedStates.length > 0 && requiredDocumentCount != null && (
              <p className="text-sm text-emerald-700">
                {requiredDocumentCount} document{requiredDocumentCount === 1 ? '' : 's'} required for
                your selected states.
              </p>
            )}
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            {error}
          </div>
        )}
      </div>

      {toast && (
        <InlineToast
          message={toast.message}
          tone={toast.tone}
          onDismiss={() => setToast(null)}
        />
      )}
    </>
  );
});

export default OperatingStatesStep;