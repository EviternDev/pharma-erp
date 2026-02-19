import { getDb } from '../index';
import { toCamelCase } from '../utils';
import type { Supplier, SupplierPayment, PaymentMode } from '@/types';

interface SupplierRow {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  gst_in: string | null;
  drug_license_no: string | null;
  created_at: string;
  updated_at: string;
}

function mapSupplierRow(row: SupplierRow): Supplier {
  return toCamelCase<Supplier>(row);
}

export async function getSuppliers(): Promise<Supplier[]> {
  const db = await getDb();
  const rows = await db.select<SupplierRow[]>('SELECT * FROM suppliers ORDER BY name');
  return rows.map(mapSupplierRow);
}

export async function getSupplierById(id: number): Promise<Supplier | null> {
  const db = await getDb();
  const rows = await db.select<SupplierRow[]>('SELECT * FROM suppliers WHERE id = $1', [id]);
  return rows.length > 0 ? mapSupplierRow(rows[0]) : null;
}

export async function searchSuppliers(term: string): Promise<Supplier[]> {
  const db = await getDb();
  const searchTerm = `%${term}%`;
  const rows = await db.select<SupplierRow[]>(
    `SELECT * FROM suppliers 
     WHERE name LIKE $1 OR phone LIKE $1 OR gst_in LIKE $1
     ORDER BY name
     LIMIT 50`,
    [searchTerm]
  );
  return rows.map(mapSupplierRow);
}

export async function createSupplier(data: {
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  gstIn?: string | null;
  drugLicenseNo?: string | null;
}): Promise<number> {
  const db = await getDb();
  const result = await db.execute(
    'INSERT INTO suppliers (name, phone, email, address, gst_in, drug_license_no) VALUES ($1, $2, $3, $4, $5, $6)',
    [
      data.name,
      data.phone ?? null,
      data.email ?? null,
      data.address ?? null,
      data.gstIn ?? null,
      data.drugLicenseNo ?? null,
    ]
  );
  return result.lastInsertId ?? 0;
}

export async function updateSupplier(
  id: number,
  data: {
    name?: string;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    gstIn?: string | null;
    drugLicenseNo?: string | null;
  }
): Promise<void> {
  const db = await getDb();
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let paramIdx = 1;

  const fieldMap: Record<string, string> = {
    name: 'name',
    phone: 'phone',
    email: 'email',
    address: 'address',
    gstIn: 'gst_in',
    drugLicenseNo: 'drug_license_no',
  };

  for (const [jsKey, sqlKey] of Object.entries(fieldMap)) {
    const value = data[jsKey as keyof typeof data];
    if (value !== undefined) {
      setClauses.push(`${sqlKey} = $${paramIdx++}`);
      values.push(value);
    }
  }

  if (setClauses.length === 0) return;

  setClauses.push(`updated_at = datetime('now')`);
  values.push(id);

  await db.execute(
    `UPDATE suppliers SET ${setClauses.join(', ')} WHERE id = $${paramIdx}`,
    values
  );
}

// Supplier Payments

interface SupplierPaymentRow {
  id: number;
  supplier_id: number;
  amount_paise: number;
  payment_date: string;
  payment_mode: string;
  reference: string | null;
  notes: string | null;
  created_at: string;
}

function mapPaymentRow(row: SupplierPaymentRow): SupplierPayment {
  return {
    ...toCamelCase<SupplierPayment>(row),
    paymentMode: row.payment_mode as PaymentMode,
  };
}

export async function getSupplierPayments(supplierId: number): Promise<SupplierPayment[]> {
  const db = await getDb();
  const rows = await db.select<SupplierPaymentRow[]>(
    'SELECT * FROM supplier_payments WHERE supplier_id = $1 ORDER BY payment_date DESC',
    [supplierId]
  );
  return rows.map(mapPaymentRow);
}

export async function createSupplierPayment(data: {
  supplierId: number;
  amountPaise: number;
  paymentDate: string;
  paymentMode: PaymentMode;
  reference?: string | null;
  notes?: string | null;
}): Promise<number> {
  const db = await getDb();
  const result = await db.execute(
    `INSERT INTO supplier_payments (supplier_id, amount_paise, payment_date, payment_mode, reference, notes)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      data.supplierId,
      data.amountPaise,
      data.paymentDate,
      data.paymentMode,
      data.reference ?? null,
      data.notes ?? null,
    ]
  );
  return result.lastInsertId ?? 0;
}

export interface SupplierWithPayments extends Supplier {
  totalPayments: number;
}

export async function getSuppliersWithPayments(): Promise<SupplierWithPayments[]> {
  const db = await getDb();
  const rows = await db.select<(SupplierRow & { total_payments: number })[]>(
    `SELECT s.*, 
       COALESCE(SUM(sp.amount_paise), 0) as total_payments
     FROM suppliers s
     LEFT JOIN supplier_payments sp ON s.id = sp.supplier_id
     GROUP BY s.id
     ORDER BY s.name`
  );
  return rows.map((row) => ({
    ...mapSupplierRow(row),
    totalPayments: row.total_payments,
  }));
}
