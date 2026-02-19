import { getDb } from '../index';
import { toCamelCase } from '../utils';
import type { Customer } from '@/types';

interface CustomerRow {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  created_at: string;
  updated_at: string;
}

function mapCustomerRow(row: CustomerRow): Customer {
  return toCamelCase<Customer>(row);
}

export async function getCustomers(): Promise<Customer[]> {
  const db = await getDb();
  const rows = await db.select<CustomerRow[]>('SELECT * FROM customers ORDER BY name');
  return rows.map(mapCustomerRow);
}

export async function getCustomerById(id: number): Promise<Customer | null> {
  const db = await getDb();
  const rows = await db.select<CustomerRow[]>('SELECT * FROM customers WHERE id = $1', [id]);
  return rows.length > 0 ? mapCustomerRow(rows[0]) : null;
}

export async function searchCustomers(term: string): Promise<Customer[]> {
  const db = await getDb();
  const searchTerm = `%${term}%`;
  const rows = await db.select<CustomerRow[]>(
    `SELECT * FROM customers 
     WHERE name LIKE $1 OR phone LIKE $1 OR email LIKE $1
     ORDER BY name
     LIMIT 50`,
    [searchTerm]
  );
  return rows.map(mapCustomerRow);
}

export async function createCustomer(data: {
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
}): Promise<number> {
  const db = await getDb();
  const result = await db.execute(
    'INSERT INTO customers (name, phone, email, address) VALUES ($1, $2, $3, $4)',
    [data.name, data.phone ?? null, data.email ?? null, data.address ?? null]
  );
  return result.lastInsertId ?? 0;
}

export async function updateCustomer(
  id: number,
  data: {
    name?: string;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
  }
): Promise<void> {
  const db = await getDb();
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let paramIdx = 1;

  if (data.name !== undefined) {
    setClauses.push(`name = $${paramIdx++}`);
    values.push(data.name);
  }
  if (data.phone !== undefined) {
    setClauses.push(`phone = $${paramIdx++}`);
    values.push(data.phone);
  }
  if (data.email !== undefined) {
    setClauses.push(`email = $${paramIdx++}`);
    values.push(data.email);
  }
  if (data.address !== undefined) {
    setClauses.push(`address = $${paramIdx++}`);
    values.push(data.address);
  }

  if (setClauses.length === 0) return;

  setClauses.push(`updated_at = datetime('now')`);
  values.push(id);

  await db.execute(
    `UPDATE customers SET ${setClauses.join(', ')} WHERE id = $${paramIdx}`,
    values
  );
}

export interface CustomerWithStats extends Customer {
  totalPurchases: number;
  lastPurchaseDate: string | null;
}

export async function getCustomersWithStats(): Promise<CustomerWithStats[]> {
  const db = await getDb();
  const rows = await db.select<(CustomerRow & { total_purchases: number; last_purchase_date: string | null })[]>(
    `SELECT c.*, 
       COUNT(s.id) as total_purchases,
       MAX(s.sale_date) as last_purchase_date
     FROM customers c
     LEFT JOIN sales s ON c.id = s.customer_id
     GROUP BY c.id
     ORDER BY c.name`
  );
  return rows.map((row) => ({
    ...mapCustomerRow(row),
    totalPurchases: row.total_purchases,
    lastPurchaseDate: row.last_purchase_date,
  }));
}
