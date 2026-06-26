'use client';

type SoftDeleteConfirmModalProps = {
  open: boolean;
  title: string;
  description: string;
  entityLabel: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function SoftDeleteConfirmModal({
  open,
  title,
  description,
  entityLabel,
  loading = false,
  onConfirm,
  onCancel,
}: SoftDeleteConfirmModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
      <div
        className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-6 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="soft-delete-title"
      >
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
            />
          </svg>
        </div>

        <h2 id="soft-delete-title" className="text-xl font-bold text-red-900">
          {title}
        </h2>
        <p className="mt-2 text-sm text-gray-600">{description}</p>
        <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
          {entityLabel}
        </p>
        <p className="mt-3 text-xs text-gray-500">
          This is a soft delete. The record will be hidden from the platform but can be restored from
          Deleted Items.
        </p>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
          >
            {loading ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}