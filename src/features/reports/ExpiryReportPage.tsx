import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { Clock, DownloadIcon, AlertTriangle } from "lucide-react";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { getDb } from "@/db/index";
import { formatPaiseToCurrency, paiseToRupeesString } from "@/lib/currency";
import { Button } from "@/components/ui/button";
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
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatExpiryDate(dateStr: string): string {
  try {
    const date = new Date(dateStr + "T00:00:00");
    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function formatDaysRemaining(days: number): string {
  if (days < 0) {
    return `${Math.abs(days)}d overdue`;
  }
  if (days === 0) return "Today";
  return `${days}d`;
}

function todayISO(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// ---------------------------------------------------------------------------
// Local DB query (NOT in src/db/queries/)
// ---------------------------------------------------------------------------

interface ExpiryReportRow {
  medicine_name: string;
  batch_number: string;
  expiry_date: string;
  days_until_expiry: number;
  quantity: number;
  cost_value: number;
  mrp_value: number;
}

async function fetchExpiryReport(
  days: number,
  includeExpired: boolean
): Promise<ExpiryReportRow[]> {
  const db = await getDb();

  let whereClause = "b.quantity > 0";
  if (includeExpired) {
    whereClause += ` AND julianday(b.expiry_date) - julianday('now') <= $1`;
  } else {
    whereClause += ` AND b.expiry_date > date('now') AND julianday(b.expiry_date) - julianday('now') <= $1`;
  }

  return db.select<ExpiryReportRow[]>(
    `SELECT m.name as medicine_name, b.batch_number, b.expiry_date,
       CAST(julianday(b.expiry_date) - julianday('now') AS INTEGER) as days_until_expiry,
       b.quantity,
       b.quantity * b.cost_price_paise as cost_value,
       b.quantity * b.mrp_paise as mrp_value
     FROM batches b
     JOIN medicines m ON b.medicine_id = m.id
     WHERE ${whereClause}
     ORDER BY b.expiry_date ASC`,
    [days]
  );
}

// ---------------------------------------------------------------------------
// CSV export
// ---------------------------------------------------------------------------

function buildCsvContent(rows: ExpiryReportRow[]): string {
  const header = [
    "Medicine Name",
    "Batch #",
    "Expiry Date",
    "Days Remaining",
    "Quantity",
    "Value at Cost",
    "Value at MRP",
  ].join(",");

  const lines = rows.map((r) => {
    const name = r.medicine_name.includes(",")
      ? `"${r.medicine_name.replace(/"/g, '""')}"`
      : r.medicine_name;
    return [
      name,
      r.batch_number,
      formatExpiryDate(r.expiry_date),
      r.days_until_expiry,
      r.quantity,
      paiseToRupeesString(r.cost_value),
      paiseToRupeesString(r.mrp_value),
    ].join(",");
  });

  return [header, ...lines].join("\n");
}

async function exportToCsv(rows: ExpiryReportRow[]) {
  const csv = buildCsvContent(rows);
  const suggestedName = `expiry-report-${todayISO()}.csv`;

  const filePath = await save({
    defaultPath: suggestedName,
    filters: [{ name: "CSV", extensions: ["csv"] }],
  });

  if (!filePath) return; // user cancelled

  await writeTextFile(filePath, csv);
  toast.success("Report exported successfully");
}

// ---------------------------------------------------------------------------
// Expiry window options
// ---------------------------------------------------------------------------

const EXPIRY_WINDOWS = [
  { value: "30", label: "Next 30 days" },
  { value: "60", label: "Next 60 days" },
  { value: "90", label: "Next 90 days" },
  { value: "180", label: "Next 180 days" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ExpiryReportPage() {
  const [expiryDays, setExpiryDays] = useState("90");
  const [includeExpired, setIncludeExpired] = useState(false);
  const [rows, setRows] = useState<ExpiryReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const loadReport = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchExpiryReport(
        Number(expiryDays),
        includeExpired
      );
      setRows(data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load expiry report");
    } finally {
      setLoading(false);
    }
  }, [expiryDays, includeExpired]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  // Summary totals
  const summary = useMemo(() => {
    let totalCostValue = 0;
    let totalMrpValue = 0;

    for (const r of rows) {
      totalCostValue += r.cost_value;
      totalMrpValue += r.mrp_value;
    }

    return {
      count: rows.length,
      totalCostValue,
      totalMrpValue,
    };
  }, [rows]);

  const handleExport = async () => {
    if (rows.length === 0) {
      toast.error("No data to export");
      return;
    }
    try {
      setExporting(true);
      await exportToCsv(rows);
    } catch (err) {
      console.error(err);
      toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  };

  /** Row text color based on days remaining */
  function getRowColorClass(days: number): string {
    if (days < 0) return "text-red-600";
    if (days <= 30) return "text-amber-600";
    return "";
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Expiry Report</h1>
          <p className="text-slate-600 mt-1">
            Track batches approaching or past expiry
          </p>
        </div>
        <Button
          onClick={handleExport}
          disabled={exporting || rows.length === 0}
          className="gap-2"
        >
          <DownloadIcon className="size-4" />
          {exporting ? "Exporting\u2026" : "Export CSV"}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-slate-700">
            Expiry Window
          </Label>
          <Select value={expiryDays} onValueChange={setExpiryDays}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EXPIRY_WINDOWS.map((w) => (
                <SelectItem key={w.value} value={w.value}>
                  {w.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label
            htmlFor="include-expired"
            className="text-sm font-medium text-slate-700"
          >
            Include Expired
          </Label>
          <div className="flex items-center h-9">
            <label
              htmlFor="include-expired"
              className="flex items-center gap-2 cursor-pointer select-none"
            >
              <input
                id="include-expired"
                type="checkbox"
                checked={includeExpired}
                onChange={(e) => setIncludeExpired(e.target.checked)}
                className="size-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500 accent-slate-900"
              />
              <span className="text-sm text-slate-600">
                Show expired batches
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      {!loading && rows.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="py-4 gap-0">
            <CardContent className="flex items-center gap-3">
              <div className="rounded-lg bg-slate-100 p-2">
                <Clock className="size-5 text-slate-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Batches at Risk</p>
                <p className="text-2xl font-bold text-slate-900 tabular-nums">
                  {summary.count}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="py-4 gap-0">
            <CardContent className="flex items-center gap-3">
              <div className="rounded-lg bg-amber-50 p-2">
                <AlertTriangle className="size-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Value at Cost</p>
                <p className="text-2xl font-bold text-slate-900 tabular-nums">
                  {formatPaiseToCurrency(summary.totalCostValue)}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="py-4 gap-0">
            <CardContent className="flex items-center gap-3">
              <div className="rounded-lg bg-red-50 p-2">
                <AlertTriangle className="size-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Value at MRP</p>
                <p className="text-2xl font-bold text-slate-900 tabular-nums">
                  {formatPaiseToCurrency(summary.totalMrpValue)}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border bg-card shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <p className="text-muted-foreground text-sm">Loading&hellip;</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Clock className="size-10 text-muted-foreground/40" />
            <p className="text-muted-foreground text-sm">
              No batches found for the selected window.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Medicine Name</TableHead>
                <TableHead>Batch #</TableHead>
                <TableHead>Expiry Date</TableHead>
                <TableHead className="text-right">Days Remaining</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">
                  Value at Cost (&#8377;)
                </TableHead>
                <TableHead className="text-right">
                  Value at MRP (&#8377;)
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {rows.map((row, idx) => {
                const colorClass = getRowColorClass(row.days_until_expiry);
                return (
                  <TableRow key={`${row.batch_number}-${idx}`}>
                    <TableCell className={`font-medium text-sm ${colorClass}`}>
                      {row.medicine_name}
                    </TableCell>
                    <TableCell
                      className={`font-mono text-sm text-slate-600 ${colorClass}`}
                    >
                      {row.batch_number}
                    </TableCell>
                    <TableCell
                      className={`tabular-nums text-sm ${colorClass}`}
                    >
                      {formatExpiryDate(row.expiry_date)}
                    </TableCell>
                    <TableCell
                      className={`text-right tabular-nums text-sm font-medium ${colorClass}`}
                    >
                      {formatDaysRemaining(row.days_until_expiry)}
                    </TableCell>
                    <TableCell
                      className={`text-right tabular-nums text-sm ${colorClass}`}
                    >
                      {row.quantity}
                    </TableCell>
                    <TableCell
                      className={`text-right tabular-nums text-sm ${colorClass}`}
                    >
                      {formatPaiseToCurrency(row.cost_value)}
                    </TableCell>
                    <TableCell
                      className={`text-right tabular-nums text-sm ${colorClass}`}
                    >
                      {formatPaiseToCurrency(row.mrp_value)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>

            <TableFooter>
              <TableRow className="font-bold">
                <TableCell colSpan={4}>
                  Total ({summary.count} batch
                  {summary.count !== 1 ? "es" : ""})
                </TableCell>
                <TableCell />
                <TableCell className="text-right tabular-nums">
                  {formatPaiseToCurrency(summary.totalCostValue)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatPaiseToCurrency(summary.totalMrpValue)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        )}
      </div>
    </div>
  );
}
