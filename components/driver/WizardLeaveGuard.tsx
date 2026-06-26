'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';

export type WizardLeaveGuardRegistration = {
  isDirty: boolean;
  saveAndExit: () => Promise<boolean>;
};

type WizardLeaveGuardContextValue = {
  register: (registration: WizardLeaveGuardRegistration | null) => void;
  confirmLeave: (onProceed: () => void) => void;
};

const WizardLeaveGuardContext = createContext<WizardLeaveGuardContextValue | null>(null);

function resolveNavPath(href: string): string {
  if (href.startsWith('/')) {
    return href.split('?')[0];
  }
  try {
    return new URL(href, window.location.origin).pathname;
  } catch {
    return href;
  }
}

function resolveNavHref(href: string): string {
  if (href.startsWith('/')) return href;
  try {
    const url = new URL(href, window.location.origin);
    return `${url.pathname}${url.search}`;
  } catch {
    return href;
  }
}

function isInternalHref(href: string): boolean {
  if (href.startsWith('/')) return true;
  if (href.startsWith('mailto:') || href.startsWith('tel:')) return false;
  try {
    return new URL(href, window.location.origin).origin === window.location.origin;
  } catch {
    return false;
  }
}

export function WizardLeaveGuardProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const registrationRef = useRef<WizardLeaveGuardRegistration | null>(null);
  const [guardState, setGuardState] = useState<WizardLeaveGuardRegistration | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);

  const register = useCallback((registration: WizardLeaveGuardRegistration | null) => {
    registrationRef.current = registration;
    setGuardState(registration);
  }, []);

  const isDirty = Boolean(guardState?.isDirty);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setPendingHref(null);
    setPendingAction(null);
    setModalError(null);
    setActing(false);
  }, []);

  const openLeaveModal = useCallback((options: { href?: string; onProceed?: () => void }) => {
    setPendingHref(options.href ?? null);
    setPendingAction(options.onProceed ? () => options.onProceed : null);
    setModalError(null);
    setModalOpen(true);
  }, []);

  const confirmLeave = useCallback(
    (onProceed: () => void) => {
      if (!registrationRef.current?.isDirty) {
        onProceed();
        return;
      }
      openLeaveModal({ onProceed });
    },
    [openLeaveModal]
  );

  const proceedWithoutSaving = useCallback(() => {
    const href = pendingHref;
    const action = pendingAction;
    closeModal();
    if (action) {
      action();
      return;
    }
    if (href) {
      router.push(href);
    }
  }, [closeModal, pendingAction, pendingHref, router]);

  const handleSaveAndExit = useCallback(async () => {
    const saveAndExit = registrationRef.current?.saveAndExit;
    if (!saveAndExit) return;

    setActing(true);
    setModalError(null);
    try {
      const ok = await saveAndExit();
      if (!ok) {
        setModalError('Could not save your progress. Fix any issues on this step and try again.');
        return;
      }
      closeModal();
    } finally {
      setActing(false);
    }
  }, [closeModal]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!registrationRef.current?.isDirty) return;

      const anchor = (event.target as Element).closest('a[href]');
      if (!anchor) return;
      if (anchor.getAttribute('target') === '_blank') return;
      if (anchor.hasAttribute('download')) return;

      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#') || !isInternalHref(href)) return;

      const targetPath = resolveNavPath(href);
      if (targetPath === pathname) return;

      event.preventDefault();
      event.stopPropagation();
      openLeaveModal({ href: resolveNavHref(href) });
    };

    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [openLeaveModal, pathname]);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!registrationRef.current?.isDirty) return;
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  useEffect(() => {
    if (!isDirty) return;

    window.history.pushState({ wizardLeaveGuard: true }, '');
    const onPopState = () => {
      window.history.pushState({ wizardLeaveGuard: true }, '');
      openLeaveModal({
        onProceed: () => {
          router.back();
        },
      });
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [isDirty, openLeaveModal, router]);

  return (
    <WizardLeaveGuardContext.Provider value={{ register, confirmLeave }}>
      {children}

      {modalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4">
          <div
            className="w-full max-w-md rounded-2xl border border-amber-200 bg-white p-6 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="wizard-leave-title"
          >
            <h2 id="wizard-leave-title" className="text-xl font-bold text-blue-950">
              Leave profile wizard?
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              You have unsaved changes on this step. Save your progress, leave without saving, or
              stay on this page.
            </p>

            {modalError && (
              <div
                className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
                role="alert"
              >
                {modalError}
              </div>
            )}

            <div className="mt-6 flex flex-col gap-3">
              <button
                type="button"
                onClick={() => void handleSaveAndExit()}
                disabled={acting}
                className="rounded-xl bg-[#1E3A8A] px-5 py-3 text-sm font-semibold text-white hover:bg-[#162d6b] disabled:opacity-60"
              >
                {acting ? 'Saving…' : 'Save & Exit'}
              </button>
              <button
                type="button"
                onClick={proceedWithoutSaving}
                disabled={acting}
                className="rounded-xl border border-gray-300 px-5 py-3 text-sm font-medium text-blue-950 hover:bg-gray-50 disabled:opacity-60"
              >
                Leave without saving
              </button>
              <button
                type="button"
                onClick={closeModal}
                disabled={acting}
                className="rounded-xl px-5 py-3 text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-60"
              >
                Stay on this page
              </button>
            </div>
          </div>
        </div>
      )}
    </WizardLeaveGuardContext.Provider>
  );
}

export function useRegisterWizardLeaveGuard(registration: WizardLeaveGuardRegistration | null) {
  const context = useContext(WizardLeaveGuardContext);

  useEffect(() => {
    if (!context) return;
    context.register(registration);
    return () => context.register(null);
  }, [context, registration]);
}

export function useWizardLeaveGuard() {
  const context = useContext(WizardLeaveGuardContext);
  return {
    confirmLeave: context?.confirmLeave ?? ((onProceed: () => void) => onProceed()),
  };
}