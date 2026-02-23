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
  // Step 1: Read invoice counter (read-only, no lock needed)
  const settingsRows = await db.select<{ invoice_prefix: string; next_invoice_number: number }[]>(
    'SELECT invoice_prefix, next_invoice_number FROM pharmacy_settings WHERE id = 1'
  );
  const prefix = settingsRows[0]?.invoice_prefix ?? 'INV';
  const number = settingsRows[0]?.next_invoice_number ?? 1;
  const invoiceNumber = data.invoiceNumber ?? `${prefix}-${String(number).padStart(6, '0')}`;
  // Step 2: Increment invoice counter + insert sale header atomically.
  // tauri-plugin-sql has no transaction() API; separate execute() calls go through SQLx
  // connection pooling and cannot share a BEGIN/COMMIT across calls.
  // We use a single multi-statement execute() for atomicity within each step.
  const customerIdLiteral = data.customerId === null ? 'NULL' : String(data.customerId);
  const notesLiteral = data.notes ? `'${data.notes.replace(/'/g, "''")}'` : 'NULL';
  const headerSql = [
    'BEGIN;',
    `UPDATE pharmacy_settings SET next_invoice_number = next_invoice_number + 1 WHERE id = 1;`,
    `INSERT INTO sales (invoice_number, customer_id, user_id, subtotal_paise, discount_paise, total_cgst_paise, total_sgst_paise, total_gst_paise, grand_total_paise, payment_mode, notes)`,
    `VALUES ('${invoiceNumber}', ${customerIdLiteral}, ${data.userId}, ${data.subtotalPaise}, ${data.discountPaise}, ${data.totalCgstPaise}, ${data.totalSgstPaise}, ${data.totalGstPaise}, ${data.grandTotalPaise}, '${data.paymentMode}', ${notesLiteral});`,
    'COMMIT;',
  ].join('\n');
  const headerResult = await db.execute(headerSql);
  const saleId = headerResult.lastInsertId ?? 0;

  // Step 3: Insert all sale items + deduct stock in one atomic execute().
  // saleId is known, so no last_insert_rowid() ambiguity across items.
  if (data.items.length > 0) {
    const itemStatements = data.items.map((item) => {
      const hsnLiteral = `'${item.hsnCode.replace(/'/g, "''")}'`;
      return [
        `INSERT INTO sale_items (sale_id, batch_id, medicine_id, quantity, unit_price_paise, discount_paise, taxable_amount_paise, cgst_rate, cgst_amount_paise, sgst_rate, sgst_amount_paise, total_paise, hsn_code)`,
        `VALUES (${saleId}, ${item.batchId}, ${item.medicineId}, ${item.quantity}, ${item.unitPricePaise}, ${item.discountPaise}, ${item.taxableAmountPaise}, ${item.cgstRate}, ${item.cgstAmountPaise}, ${item.sgstRate}, ${item.sgstAmountPaise}, ${item.totalPaise}, ${hsnLiteral});`,
        `UPDATE batches SET quantity = quantity - ${item.quantity} WHERE id = ${item.batchId};`,
      ].join(' ');
    });

    const itemsSql = ['BEGIN;', ...itemStatements, 'COMMIT;'].join('\n');
    await db.execute(itemsSql);
  }

  return saleId;
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
