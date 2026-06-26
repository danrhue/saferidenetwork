/** Rider-facing trip status badge for My Trips and trip detail views. */
const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  awaiting_payment: {
    label: 'Awaiting payment',
    className: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  open: {
    label: 'Awaiting driver',
    className: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  },
  pending_assignment: {
    label: 'Confirm driver',
    className: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  assigned: {
    label: 'Driver assigned',
    className: 'bg-green-50 text-green-800 border-green-200',
  },
  in_progress: {
    label: 'In progress',
    className: 'bg-blue-50 text-blue-800 border-blue-200',
  },
  completed: {
    label: 'Completed',
    className: 'bg-purple-50 text-purple-800 border-purple-200',
  },
  cancelled: {
    label: 'Cancelled',
    className: 'bg-gray-100 text-gray-700 border-gray-200',
  },
};

export default function TripStatusBadge({ status }: { status: string }) {
  const config = STATUS_STYLES[status] ?? {
    label: status.replace(/_/g, ' '),
    className: 'bg-gray-100 text-gray-700 border-gray-200',
  };

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${config.className}`}
    >
      {config.label}
    </span>
  );
}