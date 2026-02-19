import { getDb } from '../index';
import type { GstSlab } from '@/types';

export async function getGstSlabs(): Promise<GstSlab[]> {
  const db = await getDb();
  return await db.select<GstSlab[]>('SELECT * FROM gst_slabs ORDER BY rate');
}

export async function getGstSlabById(id: number): Promise<GstSlab | null> {
  const db = await getDb();
  const rows = await db.select<GstSlab[]>('SELECT * FROM gst_slabs WHERE id = $1', [id]);
  return rows.length > 0 ? rows[0] : null;
}
