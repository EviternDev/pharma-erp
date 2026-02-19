import { getDb } from '../index';
import type { StockAlert, ExpiryAlert } from '@/types';

/**
 * Get medicines with stock below reorder level.
 */
export async function getStockAlerts(): Promise<StockAlert[]> {
  const db = await getDb();
  const rows = await db.select<{ medicine_id: number; medicine_name: string; current_stock: number; reorder_level: number }[]>(
    `SELECT 
       m.id as medicine_id,
       m.name as medicine_name,
       COALESCE(SUM(CASE WHEN b.expiry_date > date('now') AND b.quantity > 0 THEN b.quantity ELSE 0 END), 0) as current_stock,
       m.reorder_level
     FROM medicines m
     LEFT JOIN batches b ON m.id = b.medicine_id
     WHERE m.is_active = 1
     GROUP BY m.id
     HAVING current_stock < m.reorder_level
     ORDER BY current_stock ASC`
  );

  return rows.map((row) => ({
    medicineId: row.medicine_id,
    medicineName: row.medicine_name,
    currentStock: row.current_stock,
    reorderLevel: row.reorder_level,
  }));
}

/**
 * Get batches expiring within the specified number of days.
 */
export async function getExpiryAlerts(nearExpiryDays = 90): Promise<ExpiryAlert[]> {
  const db = await getDb();
  const rows = await db.select<{
    batch_id: number;
    medicine_name: string;
    batch_number: string;
    expiry_date: string;
    days_until_expiry: number;
    quantity: number;
  }[]>(
    `SELECT 
       b.id as batch_id,
       m.name as medicine_name,
       b.batch_number,
       b.expiry_date,
       CAST(julianday(b.expiry_date) - julianday('now') AS INTEGER) as days_until_expiry,
       b.quantity
     FROM batches b
     JOIN medicines m ON b.medicine_id = m.id
     WHERE b.quantity > 0
       AND b.expiry_date > date('now')
       AND julianday(b.expiry_date) - julianday('now') <= $1
     ORDER BY b.expiry_date ASC`,
    [nearExpiryDays]
  );

  return rows.map((row) => ({
    batchId: row.batch_id,
    medicineName: row.medicine_name,
    batchNumber: row.batch_number,
    expiryDate: row.expiry_date,
    daysUntilExpiry: row.days_until_expiry,
    quantity: row.quantity,
  }));
}

/**
 * Dashboard summary counts.
 */
export async function getDashboardCounts(): Promise<{
  totalMedicines: number;
  lowStockCount: number;
  expiringCount: number;
  todaySalesCount: number;
  todayRevenuePaise: number;
}> {
  const db = await getDb();

  const [medicines, lowStock, expiring, todaySales] = await Promise.all([
    db.select<{ count: number }[]>('SELECT COUNT(*) as count FROM medicines WHERE is_active = 1'),
    db.select<{ count: number }[]>(
      `SELECT COUNT(*) as count FROM (
         SELECT m.id
         FROM medicines m
         LEFT JOIN batches b ON m.id = b.medicine_id AND b.expiry_date > date('now') AND b.quantity > 0
         WHERE m.is_active = 1
         GROUP BY m.id
         HAVING COALESCE(SUM(b.quantity), 0) < m.reorder_level
       )`
    ),
    db.select<{ count: number }[]>(
      `SELECT COUNT(*) as count FROM batches b
       JOIN medicines m ON b.medicine_id = m.id
       WHERE b.quantity > 0 AND b.expiry_date > date('now')
         AND julianday(b.expiry_date) - julianday('now') <= 90`
    ),
    db.select<{ count: number; revenue: number | null }[]>(
      `SELECT COUNT(*) as count, SUM(grand_total_paise) as revenue
       FROM sales WHERE date(sale_date) = date('now')`
    ),
  ]);

  return {
    totalMedicines: medicines[0]?.count ?? 0,
    lowStockCount: lowStock[0]?.count ?? 0,
    expiringCount: expiring[0]?.count ?? 0,
    todaySalesCount: todaySales[0]?.count ?? 0,
    todayRevenuePaise: todaySales[0]?.revenue ?? 0,
  };
}
