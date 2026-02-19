import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { SearchIcon, ReceiptIcon, EyeIcon } from "lucide-react";
import type { Sale } from "@/types";
import { getSalesWithDetails } from "@/db/queries/sales";
import { formatPaiseToCurrency } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

interface SaleRow extends Sale {
  customerName: string | null;
  userName: string;
  itemCount: number;
}

export default function SalesHistoryPage() {
  const navigate = useNavigate();
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [filteredSales, setFilteredSales] = useState<SaleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const loadSales = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getSalesWithDetails(500);
      setSales(data);
      setFilteredSales(data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load sales");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSales();
  }, [loadSales]);

  // Filter on search
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredSales(sales);
      return;
    }

    const term = searchTerm.toLowerCase().trim();
    setFilteredSales(
      sales.filter(
        (s) =>
          s.invoiceNumber.toLowerCase().includes(term) ||
          (s.customerName && s.customerName.toLowerCase().includes(term))
      )
    );
  }, [searchTerm, sales]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Sales History</h1>
          <p className="text-slate-600 mt-1">View past sales and invoices</p>
        </div>
        <Button onClick={() => navigate("/sales/new")} className="gap-2">
          New Sale
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
        <Input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by invoice # or customer\u2026"
          className="pl-9"
        />
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <p className="text-muted-foreground text-sm">Loading sales\u2026</p>
          </div>
        ) : filteredSales.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <ReceiptIcon className="size-10 text-muted-foreground/40" />
            <p className="text-muted-foreground text-sm">
              {searchTerm.trim()
                ? "No sales match your search."
                : "No sales recorded yet."}
            </p>
            {!searchTerm.trim() && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/sales/new")}
              >
                Create your first sale
              </Button>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead className="text-center">Items</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSales.map((sale) => (
                <TableRow
                  key={sale.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate(`/sales/invoice/${sale.id}`)}
                >
                  <TableCell className="font-mono font-medium text-sm">
                    {sale.invoiceNumber}
                  </TableCell>
                  <TableCell className="text-slate-600 text-sm whitespace-nowrap">
                    {formatDate(sale.saleDate)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {sale.customerName ?? (
                      <span className="text-muted-foreground">Walk-in</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center tabular-nums text-sm">
                    {sale.itemCount}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize text-xs">
                      {sale.paymentMode}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm font-medium">
                    {formatPaiseToCurrency(sale.grandTotalPaise)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/sales/invoice/${sale.id}`);
                      }}
                      title="View invoice"
                    >
                      <EyeIcon className="size-4" />
                    </Button>
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
