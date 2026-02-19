import { getDb } from '../index';
import { toCamelCase } from '../utils';
import type { Prescription } from '@/types';

interface PrescriptionRow {
  id: number;
  customer_id: number;
  sale_id: number | null;
  doctor_name: string;
  rx_number: string | null;
  prescription_date: string;
  notes: string | null;
  created_at: string;
}

function mapPrescriptionRow(row: PrescriptionRow): Prescription {
  return toCamelCase<Prescription>(row);
}

export async function getPrescriptionsByCustomer(customerId: number): Promise<Prescription[]> {
  const db = await getDb();
  const rows = await db.select<PrescriptionRow[]>(
    'SELECT * FROM prescriptions WHERE customer_id = $1 ORDER BY prescription_date DESC',
    [customerId]
  );
  return rows.map(mapPrescriptionRow);
}

export async function createPrescription(data: {
  customerId: number;
  saleId?: number | null;
  doctorName: string;
  rxNumber?: string | null;
  prescriptionDate: string;
  notes?: string | null;
}): Promise<number> {
  const db = await getDb();
  const result = await db.execute(
    `INSERT INTO prescriptions (customer_id, sale_id, doctor_name, rx_number, prescription_date, notes)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      data.customerId,
      data.saleId ?? null,
      data.doctorName,
      data.rxNumber ?? null,
      data.prescriptionDate,
      data.notes ?? null,
    ]
  );
  return result.lastInsertId ?? 0;
}

export async function linkPrescriptionToSale(prescriptionId: number, saleId: number): Promise<void> {
  const db = await getDb();
  await db.execute(
    'UPDATE prescriptions SET sale_id = $1 WHERE id = $2',
    [saleId, prescriptionId]
  );
}
