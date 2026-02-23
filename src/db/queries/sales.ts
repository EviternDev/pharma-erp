import { getDb } from '../index';
import { toCamelCase } from '../utils';
import type { Sale, SaleItem, SaleWithDetails, SaleItemWithDetails, PaymentMode } from '@/types';

interface SaleRow {
  id: number;
  invoice_number: string;
  customer_id: number | null;
  user_id: number;
  sale_date: string;
  subtotal_paise: number;
  discount_paise: number;
  total_cgst_paise: number;
  total_sgst_paise: number;
  total_gst_paise: number;
  grand_total_paise: number;
  payment_mode: string;
  notes: string | null;
  created_at: string;
}

interface SaleItemRow {
  id: number;
  sale_id: number;
  batch_id: number;
  medicine_id: number;
  quantity: number;
  unit_price_paise: number;
  discount_paise: number;
  taxable_amount_paise: number;
  cgst_rate: number;
  cgst_amount_paise: number;
  sgst_rate: number;
  sgst_amount_paise: number;
  total_paise: number;
  hsn_code: string;
}

function mapSaleRow(row: SaleRow): Sale {
  return {
    ...toCamelCase<Sale>(row),
    paymentMode: row.payment_mode as PaymentMode,
  };
}

function mapSaleItemRow(row: SaleItemRow): SaleItem {
  return toCamelCase<SaleItem>(row);
}

export async function getSales(limit = 100, offset = 0): Promise<Sale[]> {
  const db = await getDb();
  const rows = await db.select<SaleRow[]>(
    'SELECT * FROM sales ORDER BY sale_date DESC LIMIT $1 OFFSET $2',
    [limit, offset]
  );
  return rows.map(mapSaleRow);
}

export async function getSaleById(id: number): Promise<SaleWithDetails | null> {
  const db = await getDb();

  const saleRows = await db.select<(SaleRow & { customer_name: string | null; user_name: string })[]>(
    `SELECT s.*, c.name as customer_name, u.full_name as user_name
     FROM sales s
     LEFT JOIN customers c ON s.customer_id = c.id
     JOIN users u ON s.user_id = u.id
     WHERE s.id = $1`,
    [id]
  );

  if (saleRows.length === 0) return null;

  const saleRow = saleRows[0];

  const itemRows = await db.select<(SaleItemRow & { medicine_name: string; batch_number: string; expiry_date: string })[]>(
    `SELECT si.*, m.name as medicine_name, b.batch_number, b.expiry_date
     FROM sale_items si
     JOIN medicines m ON si.medicine_id = m.id
     JOIN batches b ON si.batch_id = b.id
     WHERE si.sale_id = $1`,
    [id]
  );
  const items: SaleItemWithDetails[] = itemRows.map((row) => ({
    ...mapSaleItemRow(row),
    medicineName: row.medicine_name,
    batchNumber: row.batch_number,
    hsnCode: row.hsn_code,
    expiryDate: row.expiry_date,
  }));

  return {
    ...mapSaleRow(saleRow),
    customerName: saleRow.customer_name,
    userName: saleRow.user_name,
    items,
  };
}

export async function getSalesWithDetails(limit = 100, offset = 0): Promise<(Sale & { customerName: string | null; userName: string; itemCount: number })[]> {
  const db = await getDb();
  const rows = await db.select<(SaleRow & { customer_name: string | null; user_name: string; item_count: number })[]>(
    `SELECT s.*, c.name as customer_name, u.full_name as user_name,
       (SELECT COUNT(*) FROM sale_items WHERE sale_id = s.id) as item_count
     FROM sales s
     LEFT JOIN customers c ON s.customer_id = c.id
     JOIN users u ON s.user_id = u.id
     ORDER BY s.sale_date DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return rows.map((row) => ({
    ...mapSaleRow(row),
    customerName: row.customer_name,
    userName: row.user_name,
    itemCount: row.item_count,
  }));
}

/**
 * Get and increment the next invoice number atomically.
 * Returns the formatted invoice number like "INV-000001".
 */
export async function getNextInvoiceNumber(): Promise<string> {
  const db = await getDb();

  const rows = await db.select<{ invoice_prefix: string; next_invoice_number: number }[]>(
    'SELECT invoice_prefix, next_invoice_number FROM pharmacy_settings WHERE id = 1'
  );

  const prefix = rows[0]?.invoice_prefix ?? 'INV';
  const number = rows[0]?.next_invoice_number ?? 1;

  // Increment for next use
  await db.execute(
    'UPDATE pharmacy_settings SET next_invoice_number = next_invoice_number + 1 WHERE id = 1'
  );

  return `${prefix}-${String(number).padStart(6, '0')}`;
}

export interface CreateSaleData {
  invoiceNumber?: string;
  customerId: number | null;
  userId: number;
  subtotalPaise: number;
  discountPaise: number;
  totalCgstPaise: number;
  totalSgstPaise: number;
  totalGstPaise: number;
  grandTotalPaise: number;
  paymentMode: PaymentMode;
  notes?: string | null;
  items: CreateSaleItemData[];
}

export interface CreateSaleItemData {
  batchId: number;
  medicineId: number;
  quantity: number;
  unitPricePaise: number;
  discountPaise: number;
  taxableAmountPaise: number;
  cgstRate: number;
  cgstAmountPaise: number;
  sgstRate: number;
  sgstAmountPaise: number;
  totalPaise: number;
  hsnCode: string;
}

/**
 * Create a complete sale with all items in a single transaction.
 * Also deducts batch quantities.
 */
export async function createSale(data: CreateSaleData): Promise<number> {
  const db = await getDb();
  await db.execute('BEGIN IMMEDIATE');
  try {
    // Generate invoice number inside transaction if not provided
    let invoiceNumber = data.invoiceNumber;
    if (!invoiceNumber) {
      const settingsRows = await db.select<{ invoice_prefix: string; next_invoice_number: number }[]>(
        'SELECT invoice_prefix, next_invoice_number FROM pharmacy_settings WHERE id = 1'
      );
      const prefix = settingsRows[0]?.invoice_prefix ?? 'INV';
      const number = settingsRows[0]?.next_invoice_number ?? 1;
      await db.execute(
        'UPDATE pharmacy_settings SET next_invoice_number = next_invoice_number + 1 WHERE id = 1'
      );
      invoiceNumber = `${prefix}-${String(number).padStart(6, '0')}`;
    }
    // Insert sale record
    const saleResult = await db.execute(
      `INSERT INTO sales (invoice_number, customer_id, user_id, subtotal_paise, discount_paise, total_cgst_paise, total_sgst_paise, total_gst_paise, grand_total_paise, payment_mode, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        invoiceNumber,
        data.customerId,
        data.userId,
        data.subtotalPaise,
        data.discountPaise,
        data.totalCgstPaise,
        data.totalSgstPaise,
        data.totalGstPaise,
        data.grandTotalPaise,
        data.paymentMode,
        data.notes ?? null,
      ]
    );

    const saleId = saleResult.lastInsertId ?? 0;
  // Insert sale items and deduct batch quantities
    for (const item of data.items) {
      await db.execute(
        `INSERT INTO sale_items (sale_id, batch_id, medicine_id, quantity, unit_price_paise, discount_paise, taxable_amount_paise, cgst_rate, cgst_amount_paise, sgst_rate, sgst_amount_paise, total_paise, hsn_code)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          saleId,
          item.batchId,
          item.medicineId,
          item.quantity,
          item.unitPricePaise,
          item.discountPaise,
          item.taxableAmountPaise,
          item.cgstRate,
          item.cgstAmountPaise,
          item.sgstRate,
          item.sgstAmountPaise,
          item.totalPaise,
          item.hsnCode,
        ]
      );
    // Deduct quantity from batch
      await db.execute(
        'UPDATE batches SET quantity = quantity - $1 WHERE id = $2',
        [item.quantity, item.batchId]
      );
    }

    await db.execute('COMMIT');
    return saleId;
  } catch (err) {
    await db.execute('ROLLBACK');
    throw err;
  }
}

export async function getSalesByDateRange(
  startDate: string,
  endDate: string
): Promise<Sale[]> {
  const db = await getDb();
  const rows = await db.select<SaleRow[]>(
    `SELECT * FROM sales 
     WHERE sale_date >= $1 AND sale_date <= $2
     ORDER BY sale_date DESC`,
    [startDate, endDate]
  );
  return rows.map(mapSaleRow);
}

export async function getSalesByCustomer(customerId: number): Promise<Sale[]> {
  const db = await getDb();
  const rows = await db.select<SaleRow[]>(
    'SELECT * FROM sales WHERE customer_id = $1 ORDER BY sale_date DESC',
    [customerId]
  );
  return rows.map(mapSaleRow);
}
