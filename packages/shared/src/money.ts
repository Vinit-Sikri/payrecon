/**
 * All monetary amounts are stored and passed between services as integer
 * minor units (e.g. cents for USD, paise for INR) to avoid floating-point
 * rounding bugs. These helpers are the only place major/minor conversion
 * should happen.
 */

export function toMinorUnits(majorAmount: number): number {
  return Math.round(majorAmount * 100);
}

export function toMajorUnits(minorAmount: number): number {
  return minorAmount / 100;
}

export function formatMinorUnits(minorAmount: number, currency: string, locale = "en-US"): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(toMajorUnits(minorAmount));
}
