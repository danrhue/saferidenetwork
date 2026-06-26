/** Centered loading indicator used across Rider Portal pages. */
export default function RiderLoadingSpinner({
  message = 'Loading...',
  className = '',
}: {
  message?: string;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center py-16 ${className}`.trim()}
      role="status"
      aria-live="polite"
    >
      <div
        className="mb-4 h-10 w-10 animate-spin rounded-full border-2 border-[#1E3A8A] border-t-transparent"
        aria-hidden
      />
      <p className="font-medium text-blue-950">{message}</p>
    </div>
  );
}