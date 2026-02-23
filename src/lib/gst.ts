/**
 * GST Calculation Engine — Pure functions for Indian GST compliance.
 *
 * All monetary values are integers in paise (1/100 INR).
 * CGST + SGST split (intra-state only).
 * MRP is GST-inclusive; taxable value is back-calculated.
 */

export interface GstBreakdown {
  cgstRate: number;
  cgstAmountPaise: number;
  sgstRate: number;
  sgstAmountPaise: number;
  totalGstPaise: number;
}

export interface SaleItemCalculation {
  unitPricePaise: number;
  quantity: number;
  discountPaise: number;
  taxableAmountPaise: number;
  cgstRate: number;
  cgstAmountPaise: number;
  sgstRate: number;
  sgstAmountPaise: number;
  totalGstPaise: number;
  totalPaise: number;
}

export interface InvoiceTotals {
  subtotalPaise: number;
  discountPaise: number;
  totalCgstPaise: number;
  totalSgstPaise: number;
  totalGstPaise: number;
  grandTotalPaise: number;
}

/**
 * Back-calculate taxable amount from a GST-inclusive price.
 * Formula: taxable = sellingPrice * 100 / (100 + gstRate)
 *
 * For 0% GST, returns the selling price unchanged.
 */
export function calculateTaxableAmount(
  sellingPricePaise: number,
  gstRate: number
): number {
  if (gstRate === 0) return sellingPricePaise;
  return Math.round((sellingPricePaise * 100) / (100 + gstRate));
}

/**
 * Calculate CGST + SGST from a taxable amount.
 *
 * Rounding strategy:
 *   totalGst = Math.round(taxable * rate / 100)
 *   cgst     = Math.floor(totalGst / 2)
 *   sgst     = totalGst - cgst
 * This ensures CGST + SGST === totalGst always (zero rounding loss).
 */
export function calculateGst(
  taxableAmountPaise: number,
  gstRate: number
): GstBreakdown {
  if (gstRate === 0) {
    return {
      cgstRate: 0,
      cgstAmountPaise: 0,
      sgstRate: 0,
      sgstAmountPaise: 0,
      totalGstPaise: 0,
    };
  }

  const totalGst = Math.round((taxableAmountPaise * gstRate) / 100);
  const cgst = Math.floor(totalGst / 2);
  const sgst = totalGst - cgst;

  return {
    cgstRate: gstRate / 2,
    cgstAmountPaise: cgst,
    sgstRate: gstRate / 2,
    sgstAmountPaise: sgst,
    totalGstPaise: totalGst,
  };
}

/**
 * Calculate a single sale line item with GST.
 *
 * lineSubtotal = unitPrice * quantity
 * afterDiscount = lineSubtotal - discount  (GST-inclusive amount)
 * taxable = back-calculated from afterDiscount
 * total = taxable + gst
 */
export function calculateLineItem(
  unitPricePaise: number,
  quantity: number,
  gstRate: number,
  discountPaise: number
): SaleItemCalculation {
  const lineSubtotal = unitPricePaise * quantity;
  const afterDiscount = lineSubtotal - discountPaise;
  const taxableAmount = calculateTaxableAmount(afterDiscount, gstRate);
  const gst = calculateGst(taxableAmount, gstRate);

  return {
    unitPricePaise,
    quantity,
    discountPaise,
    taxableAmountPaise: taxableAmount,
    cgstRate: gst.cgstRate,
    cgstAmountPaise: gst.cgstAmountPaise,
    sgstRate: gst.sgstRate,
    sgstAmountPaise: gst.sgstAmountPaise,
    totalGstPaise: gst.totalGstPaise,
    totalPaise: taxableAmount + gst.totalGstPaise,
  };
}

/**
 * Aggregate line-item calculations into invoice totals.
 */
export function calculateInvoiceTotal(
  items: SaleItemCalculation[]
): InvoiceTotals {
  let subtotalPaise = 0;
  let discountPaise = 0;
  let totalCgstPaise = 0;
  let totalSgstPaise = 0;
  let totalGstPaise = 0;
  let grandTotalPaise = 0;

  for (const item of items) {
    subtotalPaise += item.unitPricePaise * item.quantity;
    discountPaise += item.discountPaise;
    totalCgstPaise += item.cgstAmountPaise;
    totalSgstPaise += item.sgstAmountPaise;
    totalGstPaise += item.totalGstPaise;
    grandTotalPaise += item.totalPaise;
  }

  return {
    subtotalPaise,
    discountPaise,
    totalCgstPaise,
    totalSgstPaise,
    totalGstPaise,
    grandTotalPaise,
  };
}

/**
 * Validate that selling price does not exceed MRP.
 * Returns true if valid (selling <= MRP), false otherwise.
 */
export function validateNotAboveMrp(
  sellingPricePaise: number,
  mrpPaise: number
): boolean {
  return sellingPricePaise <= mrpPaise;
}
