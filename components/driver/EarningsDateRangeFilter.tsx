'use client';

type EarningsDateRangeFilterProps = {
  fromDate: string;
  toDate: string;
  onFromDateChange: (value: string) => void;
  onToDateChange: (value: string) => void;
  onApply: () => void;
  onClear: () => void;
  isFiltered: boolean;
  loading?: boolean;
};

export default function EarningsDateRangeFilter({
  fromDate,
  toDate,
  onFromDateChange,
  onToDateChange,
  onApply,
  onClear,
  isFiltered,
  loading = false,
}: EarningsDateRangeFilterProps) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-blue-950">Date Range</h2>
          <p className="text-xs text-gray-500">
            Filter completed trips by completion date, or leave blank to view weekly summaries.
          </p>
        </div>
        {isFiltered && (
          <span className="inline-flex w-fit items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-800">
            Filter active
          </span>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex flex-1 flex-col gap-1 text-xs font-medium text-gray-600">
          From
          <input
            type="date"
            value={fromDate}
            onChange={(event) => onFromDateChange(event.target.value)}
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-blue-950 focus:border-[#1E3A8A] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/20"
          />
        </label>

        <label className="flex flex-1 flex-col gap-1 text-xs font-medium text-gray-600">
          To
          <input
            type="date"
            value={toDate}
            onChange={(event) => onToDateChange(event.target.value)}
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-blue-950 focus:border-[#1E3A8A] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/20"
          />
        </label>

        <div className="flex gap-2 sm:pb-0.5">
          <button
            type="button"
            onClick={onApply}
            disabled={loading || (!fromDate && !toDate)}
            className="rounded-xl bg-[#1E3A8A] px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Apply
          </button>
          <button
            type="button"
            onClick={onClear}
            disabled={loading || !isFiltered}
            className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-blue-950 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}