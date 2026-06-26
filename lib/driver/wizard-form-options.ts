/** Shared dropdown options for the driver profile wizard. */

export type SelectOption = {
  value: string;
  label: string;
};

export const PHONE_TYPE_OPTIONS: SelectOption[] = [
  { value: 'Mobile', label: 'Mobile' },
  { value: 'Home', label: 'Home' },
  { value: 'Work', label: 'Work' },
];

export const MONTH_OPTIONS: SelectOption[] = Array.from({ length: 12 }, (_, index) => {
  const month = index + 1;
  return {
    value: String(month),
    label: new Date(2000, index, 1).toLocaleString('en-US', { month: 'long' }),
  };
});

export const HAIR_COLOR_OPTIONS: SelectOption[] = [
  'Black',
  'Brown',
  'Blonde',
  'Red',
  'Auburn',
  'Gray',
  'White',
  'Bald',
  'Other',
].map((value) => ({ value, label: value }));

export const EYE_COLOR_OPTIONS: SelectOption[] = [
  'Brown',
  'Blue',
  'Green',
  'Hazel',
  'Gray',
  'Amber',
  'Other',
].map((value) => ({ value, label: value }));

export const GENDER_OPTIONS: SelectOption[] = [
  { value: 'Male', label: 'Male' },
  { value: 'Female', label: 'Female' },
  { value: 'Non-binary', label: 'Non-binary' },
  { value: 'Prefer not to say', label: 'Prefer not to say' },
];

export const HEIGHT_FEET_OPTIONS: SelectOption[] = ['4', '5', '6', '7'].map((value) => ({
  value,
  label: `${value} ft`,
}));

export const HEIGHT_INCHES_OPTIONS: SelectOption[] = Array.from({ length: 12 }, (_, inches) => ({
  value: String(inches),
  label: `${inches} in`,
}));

export const PASSENGER_CAPACITY_OPTIONS: SelectOption[] = Array.from(
  { length: 15 },
  (_, index) => {
    const value = String(index + 1);
    return { value, label: `${value} passenger${index === 0 ? '' : 's'}` };
  }
);

const CURRENT_YEAR = new Date().getFullYear();

export function getDayOptions(month: number, year: number): SelectOption[] {
  if (!month || !year) {
    return Array.from({ length: 31 }, (_, index) => ({
      value: String(index + 1),
      label: String(index + 1),
    }));
  }

  const daysInMonth = new Date(year, month, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1;
    return { value: String(day), label: String(day) };
  });
}

/** Driver DOB years — must be at least 18 years old. */
export function getBirthYearOptions(minAge = 18, maxAge = 85): SelectOption[] {
  const maxYear = CURRENT_YEAR - minAge;
  const minYear = CURRENT_YEAR - maxAge;
  return Array.from({ length: maxYear - minYear + 1 }, (_, index) => {
    const year = maxYear - index;
    return { value: String(year), label: String(year) };
  });
}

export function getVehicleYearOptions(
  startYear = 1980,
  endYear = CURRENT_YEAR + 1
): SelectOption[] {
  return Array.from({ length: endYear - startYear + 1 }, (_, index) => {
    const year = endYear - index;
    return { value: String(year), label: String(year) };
  });
}

export function getLicenseExpirationYearOptions(
  startYear = CURRENT_YEAR,
  endYear = CURRENT_YEAR + 20
): SelectOption[] {
  return Array.from({ length: endYear - startYear + 1 }, (_, index) => {
    const year = startYear + index;
    return { value: String(year), label: String(year) };
  });
}

export function selectValue(value: unknown): string {
  if (value == null || value === '') return '';
  return String(value);
}

/** Clear day when month/year change makes the prior day invalid (e.g. Feb 31). */
export function reconcileDayAfterMonthYearChange(
  day: unknown,
  month: number | null,
  year: number | null
): number | null {
  const dayNum = typeof day === 'number' ? day : parseInt(selectValue(day), 10);
  if (!dayNum || !month || !year) return dayNum || null;
  const maxDay = new Date(year, month, 0).getDate();
  return dayNum > maxDay ? null : dayNum;
}