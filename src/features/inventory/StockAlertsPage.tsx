import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { PackageIcon } from "lucide-react";
import { getDb } from "@/db/index";
import type { StockAlert } from "@/types";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface StockAlertRow {
  medicine_id: number;
  medicine_name: string;
  current_stock: number;
  reorder_level: number;
}

async function getStockAlerts(): Promise<StockAlert[]> {
  const db = await getDb();
  const rows = await db.select<StockAlertRow[]>(
    `SELECT 
       m.id as medicine_id,
       m.name as medicine_name,
       COALESCE(SUM(CASE WHEN b.expiry_date > date('now') AND b.quantity > 0 THEN b.quantity ELSE 0 END), 0) as current_stock,
       m.reorder_level
     FROM medicines m
     LEFT JOIN batches b ON m.id = b.medicine_id
     WHERE m.is_active = 1
     GROUP BY m.id
     HAVING current_stock <= m.reorder_level
     ORDER BY current_stock ASC`
  );
  return rows.map((r) => ({
    medicineId: r.medicine_id,
    medicineName: r.medicine_name,
    currentStock: r.current_stock,
    reorderLevel: r.reorder_level,
  }));
}

export default function StockAlertsPage() {
  const [alerts, setAlerts] = useState<StockAlert[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAlerts = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getStockAlerts();
      setAlerts(data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load stock alerts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Stock Alerts</h1>
        <p className="text-slate-600 mt-1">
          Medicines below their reorder level
        </p>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <p className="text-muted-foreground text-sm">
              Loading stock alerts...
            </p>
          </div>
        ) : alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <PackageIcon className="size-10 text-muted-foreground/40" />
            <p className="text-muted-foreground text-sm">
              All medicines are adequately stocked.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Medicine</TableHead>
                <TableHead className="text-right">Current Stock</TableHead>
                <TableHead className="text-right">Reorder Level</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {alerts.map((a) => (
                <TableRow key={a.medicineId}>
                  <TableCell className="font-medium">
                    {a.medicineName}
                  </TableCell>

                  <TableCell className="text-right tabular-nums font-medium">
                    {a.currentStock}
                  </TableCell>

                  <TableCell className="text-right tabular-nums text-slate-600">
                    {a.reorderLevel}
                  </TableCell>

                  <TableCell>
                    {a.currentStock === 0 ? (
                      <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100">
                        Out of Stock
                      </Badge>
                    ) : (
                      <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100">
                        Low Stock
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
