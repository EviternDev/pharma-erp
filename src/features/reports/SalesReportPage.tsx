import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { DownloadIcon, SearchIcon, ReceiptIcon } from "lucide-react";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { getDb } from "@/db/index";
import { formatPaiseToCurrency, paiseToRupeesString } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

interface SaleReportRow {
  id: number;
  invoice_number: string;
  customer_id: number | null;
  user_id: number;
  sale_date: string;
  subtotal_paise: number;
  discount_paise: number;
  total_cgst_paise: number;
  total_sgst_paise: number;
  total_gst_paise: number;
  grand_total_paise: number;
  payment_mode: string;
  notes: string | null;
  created_at: string;
  customer_name: string | null;
  user_name: string;
  item_count: number;
}

async function fetchSalesReport(
  startDate: string,
  endDate: string,
  paymentMode: string
): Promise<SaleReportRow[]> {
  const db = await getDb();

  let sql = `SELECT s.*, c.name as customer_name, u.full_name as user_name,
    (SELECT COUNT(*) FROM sale_items WHERE sale_id = s.id) as item_count
    FROM sales s
    LEFT JOIN customers c ON s.customer_id = c.id
    JOIN users u ON s.user_id = u.id
    WHERE date(s.sale_date) >= $1 AND date(s.sale_date) <= $2`;

  const params: unknown[] = [startDate, endDate];

  if (paymentMode !== "all") {
    sql += ` AND s.payment_mode = $3`;
    params.push(paymentMode);
  }

  sql += ` ORDER BY s.sale_date DESC`;

  return db.select<SaleReportRow[]>(sql, params);
}

// ---------------------------------------------------------------------------
// CSV export
// ---------------------------------------------------------------------------

function buildCsvContent(rows: SaleReportRow[]): string {
  const header = [
    "Date",
    "Invoice #",
    "Customer",
    "Items",
    "Subtotal",
    "Discount",
    "GST",
    "Total",
    "Payment Mode",
  ].join(",");

  const lines = rows.map((r) => {
    const customer = r.customer_name
      ? `"${r.customer_name.replace(/"/g, '""')}"`
      : "Walk-in";
    return [
      formatDate(r.sale_date),
      r.invoice_number,
      customer,
      r.item_count,
      paiseToRupeesString(r.subtotal_paise),
      paiseToRupeesString(r.discount_paise),
      paiseToRupeesString(r.total_gst_paise),
      paiseToRupeesString(r.grand_total_paise),
      r.payment_mode,
    ].join(",");
  });

  return [header, ...lines].join("\n");
}

async function exportToCsv(rows: SaleReportRow[]) {
  const csv = buildCsvContent(rows);
  const suggestedName = `sales-report-${today()}.csv`;

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

export default function SalesReportPage() {
  const [startDate, setStartDate] = useState(firstOfMonth);
  const [endDate, setEndDate] = useState(today);
  const [paymentMode, setPaymentMode] = useState("all");
  const [rows, setRows] = useState<SaleReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const loadReport = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchSalesReport(startDate, endDate, paymentMode);
      setRows(data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load sales report");
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, paymentMode]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  // Summary totals
  const summary = useMemo(() => {
    let totalRevenue = 0;
    let totalDiscount = 0;
    let totalGst = 0;

    for (const r of rows) {
      totalRevenue += r.grand_total_paise;
      totalDiscount += r.discount_paise;
      totalGst += r.total_gst_paise;
    }

    return {
      count: rows.length,
      totalRevenue,
      totalDiscount,
      totalGst,
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Sales Report</h1>
          <p className="text-slate-600 mt-1">
            Filter, review, and export sales data
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
            htmlFor="start-date"
            className="text-sm font-medium text-slate-700"
          >
            From
          </label>
          <Input
            id="start-date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-40"
          />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="end-date"
            className="text-sm font-medium text-slate-700"
          >
            To
          </label>
          <Input
            id="end-date"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-40"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">
            Payment Mode
          </label>
          <Select value={paymentMode} onValueChange={setPaymentMode}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="cash">Cash</SelectItem>
              <SelectItem value="upi">UPI</SelectItem>
              <SelectItem value="card">Card</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button variant="outline" onClick={loadReport} className="gap-2">
          <SearchIcon className="size-4" />
          Apply
        </Button>
      </div>

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
                <TableHead>Customer</TableHead>
                <TableHead className="text-center">Items</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
                <TableHead className="text-right">Discount</TableHead>
                <TableHead className="text-right">GST</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="text-slate-600 text-sm whitespace-nowrap">
                    {formatDate(row.sale_date)}
                  </TableCell>
                  <TableCell className="font-mono font-medium text-sm">
                    {row.invoice_number}
                  </TableCell>
                  <TableCell className="text-sm">
                    {row.customer_name ?? (
                      <span className="text-muted-foreground">Walk-in</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center tabular-nums text-sm">
                    {row.item_count}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm">
                    {formatPaiseToCurrency(row.subtotal_paise)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm">
                    {formatPaiseToCurrency(row.discount_paise)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm">
                    {formatPaiseToCurrency(row.total_gst_paise)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm font-medium">
                    {formatPaiseToCurrency(row.grand_total_paise)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>

            <TableFooter>
              <TableRow className="font-bold">
                <TableCell colSpan={3}>
                  Total ({summary.count} sale{summary.count !== 1 ? "s" : ""})
                </TableCell>
                <TableCell />
                <TableCell className="text-right tabular-nums" />
                <TableCell className="text-right tabular-nums">
                  {formatPaiseToCurrency(summary.totalDiscount)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatPaiseToCurrency(summary.totalGst)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatPaiseToCurrency(summary.totalRevenue)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        )}
      </div>
    </div>
  );
}
