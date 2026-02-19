import { getDb } from '../index';
import { toCamelCase, toBool } from '../utils';
import type { Medicine, MedicineWithGst } from '@/types';

interface MedicineRow {
  id: number;
  name: string;
  generic_name: string | null;
  brand_name: string | null;
  manufacturer: string | null;
  dosage_form: string;
  strength: string | null;
  category: string | null;
  hsn_code: string;
  gst_slab_id: number;
  reorder_level: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

function mapMedicineRow(row: MedicineRow): Medicine {
  return {
    ...toCamelCase<Medicine>(row),
    isActive: toBool(row.is_active),
  };
}

export async function getMedicines(includeInactive = false): Promise<Medicine[]> {
  const db = await getDb();
  const query = includeInactive
    ? 'SELECT * FROM medicines ORDER BY name'
    : 'SELECT * FROM medicines WHERE is_active = 1 ORDER BY name';
  const rows = await db.select<MedicineRow[]>(query);
  return rows.map(mapMedicineRow);
}

export async function getMedicinesWithGst(includeInactive = false): Promise<MedicineWithGst[]> {
  const db = await getDb();
  const activeClause = includeInactive ? '' : 'WHERE m.is_active = 1';
  const rows = await db.select<(MedicineRow & { gst_rate: number })[]>(
    `SELECT m.*, g.rate as gst_rate FROM medicines m 
     JOIN gst_slabs g ON m.gst_slab_id = g.id 
     ${activeClause}
     ORDER BY m.name`
  );
  return rows.map((row) => ({
    ...mapMedicineRow(row),
    gstRate: row.gst_rate,
  }));
}

export async function getMedicineById(id: number): Promise<Medicine | null> {
  const db = await getDb();
  const rows = await db.select<MedicineRow[]>('SELECT * FROM medicines WHERE id = $1', [id]);
  return rows.length > 0 ? mapMedicineRow(rows[0]) : null;
}

export async function searchMedicines(term: string): Promise<MedicineWithGst[]> {
  const db = await getDb();
  const searchTerm = `%${term}%`;
  const rows = await db.select<(MedicineRow & { gst_rate: number })[]>(
    `SELECT m.*, g.rate as gst_rate FROM medicines m
     JOIN gst_slabs g ON m.gst_slab_id = g.id
     WHERE m.is_active = 1 
       AND (m.name LIKE $1 OR m.generic_name LIKE $1 OR m.brand_name LIKE $1)
     ORDER BY m.name
     LIMIT 50`,
    [searchTerm]
  );
  return rows.map((row) => ({
    ...mapMedicineRow(row),
    gstRate: row.gst_rate,
  }));
}

export async function createMedicine(data: {
  name: string;
  genericName?: string | null;
  brandName?: string | null;
  manufacturer?: string | null;
  dosageForm: string;
  strength?: string | null;
  category?: string | null;
  hsnCode: string;
  gstSlabId: number;
  reorderLevel: number;
}): Promise<number> {
  const db = await getDb();
  const result = await db.execute(
    `INSERT INTO medicines (name, generic_name, brand_name, manufacturer, dosage_form, strength, category, hsn_code, gst_slab_id, reorder_level)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      data.name,
      data.genericName ?? null,
      data.brandName ?? null,
      data.manufacturer ?? null,
      data.dosageForm,
      data.strength ?? null,
      data.category ?? null,
      data.hsnCode,
      data.gstSlabId,
      data.reorderLevel,
    ]
  );
  return result.lastInsertId ?? 0;
}

export async function updateMedicine(
  id: number,
  data: {
    name?: string;
    genericName?: string | null;
    brandName?: string | null;
    manufacturer?: string | null;
    dosageForm?: string;
    strength?: string | null;
    category?: string | null;
    hsnCode?: string;
    gstSlabId?: number;
    reorderLevel?: number;
    isActive?: boolean;
  }
): Promise<void> {
  const db = await getDb();
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let paramIdx = 1;

  const fieldMap: Record<string, string> = {
    name: 'name',
    genericName: 'generic_name',
    brandName: 'brand_name',
    manufacturer: 'manufacturer',
    dosageForm: 'dosage_form',
    strength: 'strength',
    category: 'category',
    hsnCode: 'hsn_code',
    gstSlabId: 'gst_slab_id',
    reorderLevel: 'reorder_level',
  };

  for (const [jsKey, sqlKey] of Object.entries(fieldMap)) {
    const value = data[jsKey as keyof typeof data];
    if (value !== undefined) {
      setClauses.push(`${sqlKey} = $${paramIdx++}`);
      values.push(value);
    }
  }

  if (data.isActive !== undefined) {
    setClauses.push(`is_active = $${paramIdx++}`);
    values.push(data.isActive ? 1 : 0);
  }

  if (setClauses.length === 0) return;

  setClauses.push(`updated_at = datetime('now')`);
  values.push(id);

  await db.execute(
    `UPDATE medicines SET ${setClauses.join(', ')} WHERE id = $${paramIdx}`,
    values
  );
}
