'use client';

import { InputHTMLAttributes, useMemo } from 'react';
import {
  getDayOptions,
  type SelectOption,
  selectValue,
} from '@/lib/driver/wizard-form-options';
import { US_STATES } from '@/lib/driver/us-states';

const fieldClass = (hasError?: boolean) =>
  `w-full min-h-[48px] rounded-xl border px-4 py-3 text-base text-blue-950 focus:border-[#1E3A8A] focus:ring-1 focus:ring-[#1E3A8A] ${
    hasError ? 'border-red-500' : 'border-gray-300'
  }`;

export function FormFieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="mt-1 text-sm text-red-600" role="alert">
      {message}
    </p>
  );
}

export function FormInput({
  label,
  value,
  onChange,
  error,
  hint,
  ...props
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'>) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-gray-700">{label}</label>
      <input
        {...props}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={fieldClass(Boolean(error))}
      />
      {hint && !error && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
      <FormFieldError message={error} />
    </div>
  );
}

export function FormSelect({
  label,
  value,
  onChange,
  options,
  placeholder = 'Select...',
  error,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  error?: string;
  hint?: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-gray-700">{label}</label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={fieldClass(Boolean(error))}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hint && !error && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
      <FormFieldError message={error} />
    </div>
  );
}

export function UsStateSelect({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  const options = useMemo(
    () => US_STATES.map((state) => ({ value: state.code, label: `${state.name} (${state.code})` })),
    []
  );

  return (
    <FormSelect
      label={label}
      value={value}
      onChange={onChange}
      options={options}
      placeholder="Select state..."
      error={error}
    />
  );
}

export function DateOfBirthFields({
  month,
  day,
  year,
  monthOptions,
  dayOptions,
  yearOptions,
  onMonthChange,
  onDayChange,
  onYearChange,
  error,
  groupLabel = 'Date of Birth *',
}: {
  month: string;
  day: string;
  year: string;
  monthOptions: SelectOption[];
  dayOptions: SelectOption[];
  yearOptions: SelectOption[];
  onMonthChange: (value: string) => void;
  onDayChange: (value: string) => void;
  onYearChange: (value: string) => void;
  error?: string;
  groupLabel?: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-gray-700">{groupLabel}</label>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FormSelect
          label="Month"
          value={month}
          onChange={onMonthChange}
          options={monthOptions}
          placeholder="Month"
        />
        <FormSelect
          label="Day"
          value={day}
          onChange={onDayChange}
          options={dayOptions}
          placeholder="Day"
        />
        <FormSelect
          label="Year"
          value={year}
          onChange={onYearChange}
          options={yearOptions}
          placeholder="Year"
        />
      </div>
      <FormFieldError message={error} />
    </div>
  );
}

export function useDateOfBirthOptions(monthValue: unknown, yearValue: unknown) {
  const month = parseInt(selectValue(monthValue), 10);
  const year = parseInt(selectValue(yearValue), 10);
  return useMemo(() => getDayOptions(month, year), [month, year]);
}

export function SsnFields({
  ssn,
  ssnVerify,
  onSsnChange,
  onSsnVerifyChange,
  ssnError,
  ssnVerifyError,
}: {
  ssn: string;
  ssnVerify: string;
  onSsnChange: (value: string) => void;
  onSsnVerifyChange: (value: string) => void;
  ssnError?: string;
  ssnVerifyError?: string;
}) {
  const handleSsnInput = (value: string, setter: (next: string) => void) => {
    setter(value.replace(/\D/g, '').slice(0, 9));
  };

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <FormInput
        label="Social Security Number *"
        type="password"
        inputMode="numeric"
        autoComplete="off"
        value={ssn}
        onChange={(value) => handleSsnInput(value, onSsnChange)}
        maxLength={9}
        hint="9 digits. Your entry is masked for security."
        error={ssnError}
      />
      <FormInput
        label="Verify Social Security Number *"
        type="password"
        inputMode="numeric"
        autoComplete="off"
        value={ssnVerify}
        onChange={(value) => handleSsnInput(value, onSsnVerifyChange)}
        maxLength={9}
        hint="Re-enter your SSN to confirm."
        error={ssnVerifyError}
      />
    </div>
  );
}