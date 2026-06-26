import { MapPin } from 'lucide-react';

type BrowseTripRoutePlaceholderProps = {
  pickupArea: string;
  dropoffArea: string;
  className?: string;
};

export default function BrowseTripRoutePlaceholder({
  pickupArea,
  dropoffArea,
  className = 'h-40',
}: BrowseTripRoutePlaceholderProps) {
  return (
    <div
      className={`flex w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-blue-50 to-slate-100 px-4 text-center ${className}`}
    >
      <MapPin className="h-6 w-6 text-[#1E3A8A]/70" strokeWidth={2} aria-hidden />
      <p className="text-xs font-semibold uppercase tracking-wide text-blue-900/70">
        General route areas only
      </p>
      <p className="max-w-full truncate text-sm font-medium text-blue-950">
        {pickupArea}
      </p>
      <p className="text-xs text-blue-800">to</p>
      <p className="max-w-full truncate text-sm font-medium text-blue-950">
        {dropoffArea}
      </p>
      <p className="text-[11px] text-blue-800/80">
        Full addresses unlock after you are assigned.
      </p>
    </div>
  );
}