import type { Paise } from '@/types';

/**
 * Convert a rupee string (e.g. "100.50") to paise integer.
 * Returns 0 for invalid input.
 */
export function rupeesToPaise(rupees: string): Paise {
  const trimmed = rupees.trim();
  if (!trimmed || isNaN(Number(trimmed)) || Number(trimmed) < 0) return 0 as Paise;
  const [intPart = '0', decPart = '0'] = trimmed.split('.');
  const paise = parseInt(intPart, 10) * 100 + Math.round(parseInt((decPart + '0').slice(0, 2), 10));
  return (isNaN(paise) ? 0 : paise) as Paise;
}

/**
 * Convert paise integer to formatted INR string.
 * e.g. 10050 → "₹100.50"
 */
export function formatPaiseToCurrency(paise: number): string {
  const rupees = paise / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rupees);
}

/**
 * Convert paise to rupees number (for display in form inputs).
 * e.g. 10050 → 100.50
 */
export function paiseToRupees(paise: number): number {
  return paise / 100;
}

/**
 * Create a Paise value from a number.
 * Rounds to ensure integer.
 */
export function toPaise(value: number): Paise {
  return Math.round(value) as Paise;
}

/**
 * Alias for rupeesToPaise — parse a rupee string to paise integer.
 * e.g. "100.50" → 10050
 */
export function parseToPaise(rupees: string): Paise {
  return rupeesToPaise(rupees);
}

/**
 * Format paise as a plain number string in rupees (no currency symbol).
 * e.g. 10050 → "100.50"
 */
export function paiseToRupeesString(paise: number): string {
  const rupees = Math.floor(Math.abs(paise) / 100);
  const cents = Math.abs(paise) % 100;
  const sign = paise < 0 ? '-' : '';
  return `${sign}${rupees}.${String(cents).padStart(2, '0')}`;
}
