import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { DownloadIcon, PackageIcon } from "lucide-react";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { getDb } from "@/db/index";
import { formatPaiseToCurrency, paiseToRupeesString } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StockReportRow {
  medicine_id: number;
  medicine_name: string;
  category: string | null;
  reorder_level: number;
  total_stock: number;
  total_cost_value: number;
  total_mrp_value: number;
}

type StockStatus = "ok" | "low" | "out";

// ---------------------------------------------------------------------------
// Local DB query (NOT in src/db/queries/)
// ---------------------------------------------------------------------------

async function fetchStockReport(): Promise<StockReportRow[]> {
  const db = await getDb();
  return db.select<StockReportRow[]>(`
    SELECT m.id as medicine_id, m.name as medicine_name, m.category, m.reorder_level,
      COALESCE(SUM(CASE WHEN b.expiry_date > date('now') AND b.quantity > 0 THEN b.quantity ELSE 0 END), 0) as total_stock,
      COALESCE(SUM(CASE WHEN b.expiry_date > date('now') AND b.quantity > 0 THEN b.quantity * b.cost_price_paise ELSE 0 END), 0) as total_cost_value,
      COALESCE(SUM(CASE WHEN b.expiry_date > date('now') AND b.quantity > 0 THEN b.quantity * b.mrp_paise ELSE 0 END), 0) as total_mrp_value
    FROM medicines m
    LEFT JOIN batches b ON m.id = b.medicine_id
    WHERE m.is_active = 1
    GROUP BY m.id
    ORDER BY m.name ASC
  `);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getStockStatus(totalStock: number, reorderLevel: number): StockStatus {
  if (totalStock === 0) return "out";
  if (totalStock < reorderLevel) return "low";
  return "ok";
}

function getStatusLabel(status: StockStatus): string {
  switch (status) {
    case "out":
      return "Out of Stock";
    case "low":
      return "Low Stock";
    case "ok":
      return "OK";
  }
}

function todayISO(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// ---------------------------------------------------------------------------
// CSV export
// ---------------------------------------------------------------------------

function buildCsvContent(rows: StockReportRow[]): string {
  const header = [
    "Medicine Name",
    "Category",
    "Total Stock",
    "Reorder Level",
    "Status",
    "Value at Cost (₹)",
    "Value at MRP (₹)",
  ].join(",");

  const lines = rows.map((r) => {
    const status = getStatusLabel(getStockStatus(r.total_stock, r.reorder_level));
    const category = r.category
      ? `"${r.category.replace(/"/g, '""')}"`
      : "";
    const name = `"${r.medicine_name.replace(/"/g, '""')}"`;
    return [
      name,
      category,
      r.total_stock,
      r.reorder_level,
      status,
      paiseToRupeesString(r.total_cost_value),
      paiseToRupeesString(r.total_mrp_value),
    ].join(",");
  });

  return [header, ...lines].join("\n");
}

async function exportToCsv(rows: StockReportRow[]) {
  const csv = buildCsvContent(rows);
  const suggestedName = `stock-report-${todayISO()}.csv`;

  const filePath = await save({
    defaultPath: suggestedName,
    filters: [{ name: "CSV", extensions: ["csv"] }],
  });

  if (!filePath) return; // user cancelled

  await writeTextFile(filePath, csv);
  toast.success("Report exported successfully");
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function StockReportPage() {
  const [rows, setRows] = useState<StockReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const loadReport = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchStockReport();
      setRows(data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load stock report");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  // Distinct categories from data
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      if (r.category) set.add(r.category);
    }
    return Array.from(set).sort();
  }, [rows]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (categoryFilter !== "all" && r.category !== categoryFilter) return false;

      if (statusFilter !== "all") {
        const status = getStockStatus(r.total_stock, r.reorder_level);
        if (statusFilter !== status) return false;
      }

      return true;
    });
  }, [rows, categoryFilter, statusFilter]);

  // Summary cards
  const summary = useMemo(() => {
    let totalCostValue = 0;
    let totalMrpValue = 0;

    for (const r of filteredRows) {
      totalCostValue += r.total_cost_value;
      totalMrpValue += r.total_mrp_value;
    }

    return {
      count: filteredRows.length,
      totalCostValue,
      totalMrpValue,
    };
  }, [filteredRows]);

  const handleExport = async () => {
    if (filteredRows.length === 0) {
      toast.error("No data to export");
      return;
    }
    try {
      setExporting(true);
      await exportToCsv(filteredRows);
    } catch (err) {
      console.error(err);
      toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Stock Report</h1>
          <p className="text-slate-600 mt-1">
            Current stock levels, values, and status overview
          </p>
        </div>
        <Button
          onClick={handleExport}
          disabled={exporting || filteredRows.length === 0}
          className="gap-2"
        >
          <DownloadIcon className="size-4" />
          {exporting ? "Exporting\u2026" : "Export CSV"}
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Medicines
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">
              {summary.count}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Value at Cost
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">
              {formatPaiseToCurrency(summary.totalCostValue)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Value at MRP
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">
              {formatPaiseToCurrency(summary.totalMrpValue)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">
            Category
          </label>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">
            Stock Status
          </label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="ok">OK</SelectItem>
              <SelectItem value="low">Low Stock</SelectItem>
              <SelectItem value="out">Out of Stock</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <p className="text-muted-foreground text-sm">Loading&hellip;</p>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <PackageIcon className="size-10 text-muted-foreground/40" />
            <p className="text-muted-foreground text-sm">
              No medicines match the selected filters.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Medicine Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Total Stock</TableHead>
                <TableHead className="text-right">Reorder Level</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Value at Cost</TableHead>
                <TableHead className="text-right">Value at MRP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.map((row) => {
                const status = getStockStatus(row.total_stock, row.reorder_level);
                return (
                  <TableRow key={row.medicine_id}>
                    <TableCell className="font-medium">
                      {row.medicine_name}
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">
                      {row.category ?? (
                        <span className="text-muted-foreground">&mdash;</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {row.total_stock}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-slate-600">
                      {row.reorder_level}
                    </TableCell>
                    <TableCell>
                      {status === "out" && (
                        <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100">
                          Out of Stock
                        </Badge>
                      )}
                      {status === "low" && (
                        <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100">
                          Low Stock
                        </Badge>
                      )}
                      {status === "ok" && (
                        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">
                          OK
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {formatPaiseToCurrency(row.total_cost_value)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm font-medium">
                      {formatPaiseToCurrency(row.total_mrp_value)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
