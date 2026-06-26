import type { DriverProfileRow } from '@/lib/driver-profile';

export function formatAdminDriverName(driver: DriverProfileRow): string {
  const fromParts = [driver.first_name, driver.last_name].filter(Boolean).join(' ');
  return fromParts || driver.full_name || 'Unnamed Driver';
}

export function formatAdminDate(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
}

export function formatAdminDateTime(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
}