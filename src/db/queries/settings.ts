import { getDb } from '../index';
import { toCamelCase } from '../utils';
import type { PharmacySettings } from '@/types';

interface SettingsRow {
  id: number;
  name: string;
  address: string;
  phone: string;
  email: string | null;
  gstin: string;
  drug_license_no: string;
  state_code: string;
  invoice_prefix: string;
  next_invoice_number: number;
  low_stock_threshold: number;
  near_expiry_days: number;
  created_at: string;
  updated_at: string;
}

export async function getSettings(): Promise<PharmacySettings> {
  const db = await getDb();
  const rows = await db.select<SettingsRow[]>(
    'SELECT * FROM pharmacy_settings WHERE id = 1'
  );

  if (rows.length === 0) {
    throw new Error('Pharmacy settings not found. Database may not be initialized.');
  }

  return toCamelCase<PharmacySettings>(rows[0]);
}

export async function updateSettings(data: {
  name?: string;
  address?: string;
  phone?: string;
  email?: string | null;
  gstin?: string;
  drugLicenseNo?: string;
  stateCode?: string;
  invoicePrefix?: string;
  lowStockThreshold?: number;
  nearExpiryDays?: number;
}): Promise<void> {
  const db = await getDb();
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let paramIdx = 1;

  const fieldMap: Record<string, string> = {
    name: 'name',
    address: 'address',
    phone: 'phone',
    email: 'email',
    gstin: 'gstin',
    drugLicenseNo: 'drug_license_no',
    stateCode: 'state_code',
    invoicePrefix: 'invoice_prefix',
    lowStockThreshold: 'low_stock_threshold',
    nearExpiryDays: 'near_expiry_days',
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

  await db.execute(
    `UPDATE pharmacy_settings SET ${setClauses.join(', ')} WHERE id = 1`,
    values
  );
}
