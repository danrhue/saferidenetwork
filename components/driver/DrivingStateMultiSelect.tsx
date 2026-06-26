'use client';

import { useMemo, useState } from 'react';
import { US_STATES } from '@/lib/driver/us-states';

type DrivingStateMultiSelectProps = {
  value: string[];
  onChange: (states: string[]) => void;
  disabled?: boolean;
  id?: string;
};

export default function DrivingStateMultiSelect({
  value,
  onChange,
  disabled = false,
  id = 'driving-states',
}: DrivingStateMultiSelectProps) {
  const [search, setSearch] = useState('');

  const filteredStates = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return US_STATES;
    return US_STATES.filter(
      (state) =>
        state.code.toLowerCase().includes(term) || state.name.toLowerCase().includes(term)
    );
  }, [search]);

  const selectedStates = useMemo(
    () => US_STATES.filter((state) => value.includes(state.code)),
    [value]
  );

  const toggleState = (code: string) => {
    if (disabled) return;
    if (value.includes(code)) {
      onChange(value.filter((s) => s !== code));
    } else {
      onChange([...value, code].sort());
    }
  };

  const clearAll = () => {
    if (disabled) return;
    onChange([]);
  };

  return (
    <div>
      <label htmlFor={`${id}-search`} className="mb-2 block text-sm font-medium text-blue-950">
        States you plan to drive in
      </label>
      <p className="mb-3 text-sm text-blue-800/80">
        Search and select every state where you expect to accept trips. Required documents are
        based on your selections.
      </p>

      {selectedStates.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2" aria-label="Selected states">
          {selectedStates.map((state) => (
            <button
              key={state.code}
              type="button"
              disabled={disabled}
              onClick={() => toggleState(state.code)}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-[#1E3A8A]/20 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-950 transition hover:bg-blue-100 disabled:opacity-50"
              aria-label={`Remove ${state.name}`}
            >
              <span>{state.code}</span>
              <span className="text-blue-700/60" aria-hidden>
                ✕
              </span>
            </button>
          ))}
          <button
            type="button"
            disabled={disabled}
            onClick={clearAll}
            className="min-h-10 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            Clear all
          </button>
        </div>
      )}

      <div className="sticky top-0 z-10 mb-2 rounded-xl border border-blue-200 bg-white p-2 shadow-sm">
        <input
          id={`${id}-search`}
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          disabled={disabled}
          placeholder="Search by state name or code (e.g. Kansas, KS)"
          className="w-full rounded-lg border border-blue-100 px-4 py-3 text-base text-blue-950 placeholder:text-blue-400 focus:border-[#1E3A8A] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/20"
          autoComplete="off"
        />
      </div>

      <div
        id={id}
        role="group"
        aria-label="US states"
        className="max-h-[min(52vh,22rem)] overflow-y-auto rounded-xl border border-blue-200 bg-white"
      >
        {filteredStates.length === 0 ? (
          <p className="p-6 text-center text-sm text-blue-800/70">No states match your search.</p>
        ) : (
          <ul className="divide-y divide-blue-50">
            {filteredStates.map((state) => {
              const checked = value.includes(state.code);
              return (
                <li key={state.code}>
                  <label
                    className={`flex min-h-[3.25rem] cursor-pointer items-center gap-3 px-4 py-3 text-base transition sm:min-h-12 ${
                      checked ? 'bg-blue-50 text-blue-950' : 'text-blue-900 hover:bg-gray-50'
                    } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
                  >
                    <input
                      type="checkbox"
                      className="h-5 w-5 shrink-0 rounded border-gray-300 text-[#1E3A8A] focus:ring-[#1E3A8A]"
                      checked={checked}
                      disabled={disabled}
                      onChange={() => toggleState(state.code)}
                    />
                    <span className="flex-1">
                      <span className="font-semibold">{state.name}</span>
                      <span className="ml-2 text-sm text-blue-700/70">{state.code}</span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p className="mt-2 text-xs text-blue-700/70" aria-live="polite">
        {value.length} state{value.length === 1 ? '' : 's'} selected
        {search.trim() ? ` · Showing ${filteredStates.length} match${filteredStates.length === 1 ? '' : 'es'}` : ''}
      </p>
    </div>
  );
}