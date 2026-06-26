/** Paired driver's license uploads — front and back are separate required documents. */

export const DRIVERS_LICENSE_FRONT = 'drivers_license_front';
export const DRIVERS_LICENSE_BACK = 'drivers_license_back';
export const LEGACY_DRIVERS_LICENSE = 'drivers_license';

export const DRIVERS_LICENSE_DOCUMENT_TYPES = [
  DRIVERS_LICENSE_FRONT,
  DRIVERS_LICENSE_BACK,
] as const;

export type DriversLicenseDocumentType = (typeof DRIVERS_LICENSE_DOCUMENT_TYPES)[number];

export function isDriversLicenseDocumentType(type: string): boolean {
  return (
    type === DRIVERS_LICENSE_FRONT ||
    type === DRIVERS_LICENSE_BACK ||
    type === LEGACY_DRIVERS_LICENSE
  );
}

/** The other side of a driver's license pair (front ↔ back). */
export function getPairedDriversLicenseType(type: string): DriversLicenseDocumentType | undefined {
  if (type === DRIVERS_LICENSE_FRONT || type === LEGACY_DRIVERS_LICENSE) {
    return DRIVERS_LICENSE_BACK;
  }
  if (type === DRIVERS_LICENSE_BACK) {
    return DRIVERS_LICENSE_FRONT;
  }
  return undefined;
}