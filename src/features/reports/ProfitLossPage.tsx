import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import {
  DownloadIcon,
  IndianRupee,
  TrendingUp,
  TrendingDown,
  ReceiptIcon,
} from "lucide-react";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { getDb } from "@/db/index";
import { formatPaiseToCurrency, paiseToRupeesString } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

/** YYYY-MM-DD string for <input type="date"> */
function toISODate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function firstOfMonth(): string {
  const now = new Date();
  return toISODate(new Date(now.getFullYear(), now.getMonth(), 1));
}

function today(): string {
  return toISODate(new Date());
}

// ---------------------------------------------------------------------------
// Local DB query (NOT in src/db/queries/)
// ---------------------------------------------------------------------------

interface ProfitLossRow {
  sale_date: string;
  invoice_number: string;
  medicine_name: string;
  quantity: number;
  cost_price_paise: number;
  taxable_amount_paise: number;
  profit_paise: number;
}

async function fetchProfitLossReport(
  startDate: string,
  endDate: string
): Promise<ProfitLossRow[]> {
  const db = await getDb();
  return db.select<ProfitLossRow[]>(
    `
    SELECT s.sale_date, s.invoice_number, m.name as medicine_name,
      si.quantity, b.cost_price_paise, si.taxable_amount_paise,
      (si.taxable_amount_paise - b.cost_price_paise * si.quantity) as profit_paise
    FROM sale_items si
    JOIN sales s ON si.sale_id = s.id
    JOIN medicines m ON si.medicine_id = m.id
    JOIN batches b ON si.batch_id = b.id
    WHERE date(s.sale_date) >= $1 AND date(s.sale_date) <= $2
    ORDER BY s.sale_date DESC, s.invoice_number
    `,
    [startDate, endDate]
  );
}

// ---------------------------------------------------------------------------
// CSV export
// ---------------------------------------------------------------------------

function buildCsvContent(rows: ProfitLossRow[]): string {
  const header = [
    "Date",
    "Invoice #",
    "Medicine Name",
    "Qty Sold",
    "Cost Price (₹/unit)",
    "Taxable Amount (₹)",
    "Profit (₹)",
  ].join(",");

  const lines = rows.map((r) => {
    const medicineName = `"${r.medicine_name.replace(/"/g, '""')}"`;
    return [
      formatDate(r.sale_date),
      r.invoice_number,
      medicineName,
      r.quantity,
      paiseToRupeesString(r.cost_price_paise),
      paiseToRupeesString(r.taxable_amount_paise),
      paiseToRupeesString(r.profit_paise),
    ].join(",");
  });

  return [header, ...lines].join("\n");
}

async function exportToCsv(rows: ProfitLossRow[]) {
  const csv = buildCsvContent(rows);
  const suggestedName = `profit-loss-report-${today()}.csv`;

  const filePath = await save({
    defaultPath: suggestedName,
    filters: [{ name: "CSV", extensions: ["csv"] }],
  });

  if (!filePath) return; // user cancelled

  await writeTextFile(filePath, csv);
  toast.success("Report exported successfully");
}

// ---------------------------------------------------------------------------
// Summary card component
// ---------------------------------------------------------------------------

interface SummaryCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent?: "default" | "green" | "red";
}

function SummaryCard({ label, value, icon, accent = "default" }: SummaryCardProps) {
  const accentColor =
    accent === "green"
      ? "text-emerald-600"
      : accent === "red"
        ? "text-red-600"
        : "text-slate-900";

  return (
    <Card className="py-4">
      <CardContent className="flex items-center gap-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-slate-100">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className={`text-xl font-bold tabular-nums ${accentColor}`}>
            {value}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ProfitLossPage() {
  const [startDate, setStartDate] = useState(firstOfMonth);
  const [endDate, setEndDate] = useState(today);
  const [rows, setRows] = useState<ProfitLossRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const loadReport = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchProfitLossReport(startDate, endDate);
      setRows(data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load profit & loss report");
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  // Summary totals
  const summary = useMemo(() => {
    let totalRevenue = 0;
    let totalCost = 0;

    for (const r of rows) {
      totalRevenue += r.taxable_amount_paise;
      totalCost += r.cost_price_paise * r.quantity;
    }

    const grossProfit = totalRevenue - totalCost;
    const profitMargin =
      totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

    return { totalRevenue, totalCost, grossProfit, profitMargin };
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            Profit &amp; Loss
          </h1>
          <p className="text-slate-600 mt-1">
            Track item-level profitability by date range
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
          <label
            htmlFor="pl-start-date"
            className="text-sm font-medium text-slate-700"
          >
            From
          </label>
          <Input
            id="pl-start-date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-40"
          />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="pl-end-date"
            className="text-sm font-medium text-slate-700"
          >
            To
          </label>
          <Input
            id="pl-end-date"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-40"
          />
        </div>
      </div>

      {/* Summary cards */}
      {!loading && rows.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            label="Total Revenue"
            value={formatPaiseToCurrency(summary.totalRevenue)}
            icon={<IndianRupee className="size-5 text-slate-600" />}
          />
          <SummaryCard
            label="Total Cost"
            value={formatPaiseToCurrency(summary.totalCost)}
            icon={<IndianRupee className="size-5 text-slate-600" />}
          />
          <SummaryCard
            label="Gross Profit"
            value={formatPaiseToCurrency(summary.grossProfit)}
            icon={
              summary.grossProfit >= 0 ? (
                <TrendingUp className="size-5 text-emerald-600" />
              ) : (
                <TrendingDown className="size-5 text-red-600" />
              )
            }
            accent={summary.grossProfit >= 0 ? "green" : "red"}
          />
          <SummaryCard
            label="Profit Margin"
            value={`${summary.profitMargin.toFixed(1)}%`}
            icon={
              summary.profitMargin >= 0 ? (
                <TrendingUp className="size-5 text-emerald-600" />
              ) : (
                <TrendingDown className="size-5 text-red-600" />
              )
            }
            accent={summary.profitMargin >= 0 ? "green" : "red"}
          />
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
            <ReceiptIcon className="size-10 text-muted-foreground/40" />
            <p className="text-muted-foreground text-sm">
              No sales found for the selected period.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Invoice #</TableHead>
                <TableHead>Medicine Name</TableHead>
                <TableHead className="text-center">Qty Sold</TableHead>
                <TableHead className="text-right">
                  Cost Price (₹/unit)
                </TableHead>
                <TableHead className="text-right">
                  Taxable Amount (₹)
                </TableHead>
                <TableHead className="text-right">Profit (₹)</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {rows.map((row, idx) => (
                <TableRow key={`${row.invoice_number}-${row.medicine_name}-${idx}`}>
                  <TableCell className="text-slate-600 text-sm whitespace-nowrap">
                    {formatDate(row.sale_date)}
                  </TableCell>
                  <TableCell className="font-mono font-medium text-sm">
                    {row.invoice_number}
                  </TableCell>
                  <TableCell className="text-sm">
                    {row.medicine_name}
                  </TableCell>
                  <TableCell className="text-center tabular-nums text-sm">
                    {row.quantity}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm">
                    {formatPaiseToCurrency(row.cost_price_paise)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm">
                    {formatPaiseToCurrency(row.taxable_amount_paise)}
                  </TableCell>
                  <TableCell
                    className={`text-right tabular-nums text-sm font-medium ${
                      row.profit_paise >= 0
                        ? "text-emerald-600"
                        : "text-red-600"
                    }`}
                  >
                    {formatPaiseToCurrency(row.profit_paise)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>

            <TableFooter>
              <TableRow className="font-bold">
                <TableCell colSpan={3}>
                  Total ({rows.length} item{rows.length !== 1 ? "s" : ""})
                </TableCell>
                <TableCell />
                <TableCell className="text-right tabular-nums">
                  {formatPaiseToCurrency(summary.totalCost)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatPaiseToCurrency(summary.totalRevenue)}
                </TableCell>
                <TableCell
                  className={`text-right tabular-nums ${
                    summary.grossProfit >= 0
                      ? "text-emerald-600"
                      : "text-red-600"
                  }`}
                >
                  {formatPaiseToCurrency(summary.grossProfit)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        )}
      </div>
    </div>
  );
}
