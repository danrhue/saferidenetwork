'use client';

type AdminImagePreviewModalProps = {
  imageUrl: string;
  alt: string;
  onClose: () => void;
};

export default function AdminImagePreviewModal({
  imageUrl,
  alt,
  onClose,
}: AdminImagePreviewModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Image preview"
    >
      <div
        className="relative max-h-[90vh] max-w-4xl"
        onClick={(event) => event.stopPropagation()}
      >
        <img
          src={imageUrl}
          alt={alt}
          className="max-h-[90vh] max-w-full rounded-xl object-contain shadow-2xl"
        />
        <button
          type="button"
          onClick={onClose}
          className="absolute -right-2 -top-2 flex h-10 w-10 items-center justify-center rounded-full bg-white text-xl text-gray-800 shadow-lg hover:bg-gray-100"
          aria-label="Close preview"
        >
          ×
        </button>
      </div>
    </div>
  );
}