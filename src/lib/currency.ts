import type { Paise } from '@/types';

/**
 * Convert a rupee string (e.g. "100.50") to paise integer.
 * Returns 0 for invalid input.
 */
export function rupeesToPaise(rupees: string): Paise {
  const parsed = parseFloat(rupees);
  if (isNaN(parsed) || parsed < 0) return 0 as Paise;
  return Math.round(parsed * 100) as Paise;
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
