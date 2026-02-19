import { getDb } from '../index';
import { toCamelCase } from '../utils';
import type { Batch, BatchWithMedicine } from '@/types';

interface BatchRow {
  id: number;
  medicine_id: number;
  batch_number: string;
  expiry_date: string;
  cost_price_paise: number;
  mrp_paise: number;
  selling_price_paise: number;
  quantity: number;
  manufacturing_date: string | null;
  created_at: string;
}

function mapBatchRow(row: BatchRow): Batch {
  return toCamelCase<Batch>(row);
}

export async function getBatchesByMedicine(medicineId: number, includeExpired = false): Promise<Batch[]> {
  const db = await getDb();
  const expiryClause = includeExpired ? '' : "AND expiry_date > date('now')";
  const rows = await db.select<BatchRow[]>(
    `SELECT * FROM batches WHERE medicine_id = $1 ${expiryClause} ORDER BY expiry_date ASC`,
    [medicineId]
  );
  return rows.map(mapBatchRow);
}

export async function getAllBatches(): Promise<BatchWithMedicine[]> {
  const db = await getDb();
  const rows = await db.select<(BatchRow & { medicine_name: string; generic_name: string | null })[]>(
    `SELECT b.*, m.name as medicine_name, m.generic_name 
     FROM batches b 
     JOIN medicines m ON b.medicine_id = m.id 
     ORDER BY b.expiry_date ASC`
  );
  return rows.map((row) => ({
    ...mapBatchRow(row),
    medicineName: row.medicine_name,
    genericName: row.generic_name,
  }));
}

export async function getBatchById(id: number): Promise<Batch | null> {
  const db = await getDb();
  const rows = await db.select<BatchRow[]>('SELECT * FROM batches WHERE id = $1', [id]);
  return rows.length > 0 ? mapBatchRow(rows[0]) : null;
}

/**
 * Get batches ordered by First Expiry First Out.
 * Only returns non-expired batches with quantity > 0.
 */
export async function getBatchesFEFO(medicineId: number): Promise<Batch[]> {
  const db = await getDb();
  const rows = await db.select<BatchRow[]>(
    `SELECT * FROM batches 
     WHERE medicine_id = $1 AND quantity > 0 AND expiry_date > date('now')
     ORDER BY expiry_date ASC`,
    [medicineId]
  );
  return rows.map(mapBatchRow);
}

export async function createBatch(data: {
  medicineId: number;
  batchNumber: string;
  expiryDate: string;
  costPricePaise: number;
  mrpPaise: number;
  sellingPricePaise: number;
  quantity: number;
  manufacturingDate?: string | null;
}): Promise<number> {
  const db = await getDb();
  const result = await db.execute(
    `INSERT INTO batches (medicine_id, batch_number, expiry_date, cost_price_paise, mrp_paise, selling_price_paise, quantity, manufacturing_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      data.medicineId,
      data.batchNumber,
      data.expiryDate,
      data.costPricePaise,
      data.mrpPaise,
      data.sellingPricePaise,
      data.quantity,
      data.manufacturingDate ?? null,
    ]
  );
  return result.lastInsertId ?? 0;
}

/**
 * Update batch quantity (decrement after sale, increment on return).
 * Uses atomic SQL to prevent race conditions.
 */
export async function updateBatchQuantity(batchId: number, quantityChange: number): Promise<void> {
  const db = await getDb();
  await db.execute(
    'UPDATE batches SET quantity = quantity + $1 WHERE id = $2',
    [quantityChange, batchId]
  );
}

/**
 * Get total stock for a medicine (sum of all non-expired batch quantities).
 */
export async function getMedicineStock(medicineId: number): Promise<number> {
  const db = await getDb();
  const rows = await db.select<{ total: number | null }[]>(
    `SELECT SUM(quantity) as total FROM batches 
     WHERE medicine_id = $1 AND expiry_date > date('now') AND quantity > 0`,
    [medicineId]
  );
  return rows[0]?.total ?? 0;
}
