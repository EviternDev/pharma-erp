import { describe, it, expect } from 'vitest';
import {
  calculateTaxableAmount,
  calculateGst,
  calculateLineItem,
  calculateInvoiceTotal,
  validateNotAboveMrp,
} from '../gst';

describe('GST Calculation Engine', () => {
  describe('calculateTaxableAmount', () => {
    it('back-calculates 5% GST on ₹100 MRP (10000 paise)', () => {
      // 10000 * 100 / 105 = 9523.81 → rounds to 9524
      expect(calculateTaxableAmount(10000, 5)).toBe(9524);
    });

    it('back-calculates 12% GST on ₹112 MRP (11200 paise)', () => {
      // 11200 * 100 / 112 = 10000 exactly
      expect(calculateTaxableAmount(11200, 12)).toBe(10000);
    });

    it('returns selling price unchanged for 0% GST', () => {
      expect(calculateTaxableAmount(5000, 0)).toBe(5000);
    });

    it('handles 18% GST correctly', () => {
      // 11800 * 100 / 118 = 10000 exactly
      expect(calculateTaxableAmount(11800, 18)).toBe(10000);
    });
  });

  describe('calculateGst', () => {
    it('calculates CGST/SGST for 5% on taxable 9524 paise', () => {
      const result = calculateGst(9524, 5);
      // 9524 * 5 / 100 = 476.2 → rounds to 476
      expect(result.totalGstPaise).toBe(476);
      expect(result.cgstRate).toBe(2.5);
      expect(result.sgstRate).toBe(2.5);
      // 476 / 2 = 238 exactly
      expect(result.cgstAmountPaise).toBe(238);
      expect(result.sgstAmountPaise).toBe(238);
      expect(result.cgstAmountPaise + result.sgstAmountPaise).toBe(result.totalGstPaise);
    });

    it('calculates CGST/SGST for 12% on taxable 10000 paise', () => {
      const result = calculateGst(10000, 12);
      expect(result.totalGstPaise).toBe(1200);
      expect(result.cgstRate).toBe(6);
      expect(result.sgstRate).toBe(6);
      expect(result.cgstAmountPaise).toBe(600);
      expect(result.sgstAmountPaise).toBe(600);
    });

    it('returns all zeros for 0% GST', () => {
      const result = calculateGst(5000, 0);
      expect(result.totalGstPaise).toBe(0);
      expect(result.cgstAmountPaise).toBe(0);
      expect(result.sgstAmountPaise).toBe(0);
      expect(result.cgstRate).toBe(0);
      expect(result.sgstRate).toBe(0);
    });

    it('ensures CGST + SGST === totalGst for odd GST amounts (rounding precision)', () => {
      // Odd total GST: 9999 * 5 / 100 = 499.95 → 500
      // 500 / 2 = 250 + 250 = 500 ✓
      const result1 = calculateGst(9999, 5);
      expect(result1.cgstAmountPaise + result1.sgstAmountPaise).toBe(result1.totalGstPaise);

      // Taxable 101 paise at 5%: 101 * 5 / 100 = 5.05 → 5
      // floor(5/2) = 2, sgst = 5-2 = 3
      const result2 = calculateGst(101, 5);
      expect(result2.totalGstPaise).toBe(5);
      expect(result2.cgstAmountPaise).toBe(2);
      expect(result2.sgstAmountPaise).toBe(3);
      expect(result2.cgstAmountPaise + result2.sgstAmountPaise).toBe(result2.totalGstPaise);

      // Taxable 333 paise at 18%: 333 * 18 / 100 = 59.94 → 60
      // floor(60/2) = 30, sgst = 60-30 = 30
      const result3 = calculateGst(333, 18);
      expect(result3.cgstAmountPaise + result3.sgstAmountPaise).toBe(result3.totalGstPaise);
    });
  });

  describe('calculateLineItem', () => {
    it('calculates a line item with 5% GST, no discount', () => {
      // unitPrice = 4800 paise (₹48), qty = 1, 5% GST, 0 discount
      const result = calculateLineItem(4800, 1, 5, 0);
      expect(result.unitPricePaise).toBe(4800);
      expect(result.quantity).toBe(1);
      expect(result.discountPaise).toBe(0);
      // taxable = 4800 * 100 / 105 = 4571.43 → 4571
      expect(result.taxableAmountPaise).toBe(4571);
      expect(result.cgstRate).toBe(2.5);
      expect(result.sgstRate).toBe(2.5);
      // totalGst = 4571 * 5 / 100 = 228.55 → 229
      expect(result.totalGstPaise).toBe(229);
      expect(result.totalPaise).toBe(4571 + 229);
    });

    it('calculates a line item with discount applied before GST', () => {
      // unitPrice = 4800 paise, qty = 2, 5% GST, discount = 200 paise
      const result = calculateLineItem(4800, 2, 5, 200);
      // lineSubtotal = 4800 * 2 = 9600
      // afterDiscount = 9600 - 200 = 9400
      // taxable = 9400 * 100 / 105 = 8952.38 → 8952
      expect(result.taxableAmountPaise).toBe(8952);
      const gst = calculateGst(8952, 5);
      expect(result.totalGstPaise).toBe(gst.totalGstPaise);
      expect(result.totalPaise).toBe(8952 + gst.totalGstPaise);
    });
  });

  describe('calculateInvoiceTotal', () => {
    it('aggregates multiple items with mixed GST rates', () => {
      // Item 1: ₹48 x 2, 5% GST, no discount
      const item1 = calculateLineItem(4800, 2, 5, 0);
      // Item 2: ₹112 x 1, 12% GST, no discount
      const item2 = calculateLineItem(11200, 1, 12, 0);

      const totals = calculateInvoiceTotal([item1, item2]);

      expect(totals.subtotalPaise).toBe(4800 * 2 + 11200 * 1);
      expect(totals.discountPaise).toBe(0);
      expect(totals.totalCgstPaise).toBe(item1.cgstAmountPaise + item2.cgstAmountPaise);
      expect(totals.totalSgstPaise).toBe(item1.sgstAmountPaise + item2.sgstAmountPaise);
      expect(totals.totalGstPaise).toBe(item1.totalGstPaise + item2.totalGstPaise);
      expect(totals.grandTotalPaise).toBe(item1.totalPaise + item2.totalPaise);
    });

    it('handles empty items array', () => {
      const totals = calculateInvoiceTotal([]);
      expect(totals.subtotalPaise).toBe(0);
      expect(totals.discountPaise).toBe(0);
      expect(totals.totalCgstPaise).toBe(0);
      expect(totals.totalSgstPaise).toBe(0);
      expect(totals.totalGstPaise).toBe(0);
      expect(totals.grandTotalPaise).toBe(0);
    });
  });

  describe('validateNotAboveMrp', () => {
    it('returns true when selling price equals MRP', () => {
      expect(validateNotAboveMrp(5000, 5000)).toBe(true);
    });

    it('returns true when selling price is below MRP', () => {
      expect(validateNotAboveMrp(4800, 5000)).toBe(true);
    });

    it('returns false when selling price exceeds MRP', () => {
      expect(validateNotAboveMrp(5001, 5000)).toBe(false);
    });
  });

  describe('Edge cases', () => {
    it('handles 1 paise item with 5% GST without NaN or Infinity', () => {
      const result = calculateLineItem(1, 1, 5, 0);
      expect(Number.isFinite(result.taxableAmountPaise)).toBe(true);
      expect(Number.isFinite(result.totalGstPaise)).toBe(true);
      expect(Number.isFinite(result.totalPaise)).toBe(true);
      expect(result.totalPaise).toBeGreaterThanOrEqual(0);
      // 1 * 100 / 105 = 0.952 → 1
      expect(result.taxableAmountPaise).toBe(1);
    });

    it('handles large amounts without overflow', () => {
      // ₹10,00,000 = 10_00_00_000 paise
      const result = calculateLineItem(100000000, 1, 18, 0);
      expect(Number.isFinite(result.totalPaise)).toBe(true);
      expect(result.cgstAmountPaise + result.sgstAmountPaise).toBe(result.totalGstPaise);
    });
  });
});
