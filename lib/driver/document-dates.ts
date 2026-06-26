/** Format ISO timestamp for HTML date input (local calendar date). */
export function toDateInputValue(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** End-of-day UTC ISO string for storage from YYYY-MM-DD input. */
export function dateInputToExpiresAt(dateInput: string): string {
  return `${dateInput}T23:59:59Z`;
}