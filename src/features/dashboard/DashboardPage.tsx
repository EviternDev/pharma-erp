import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ShoppingCart,
  Pill,
  AlertTriangle,
  Clock,
  Plus,
  ArrowRight,
  ReceiptIcon,
  PackageOpen,
} from "lucide-react";
import type { Sale, StockAlert } from "@/types";
import { getDashboardCounts, getStockAlerts } from "@/db/queries/reports";
import { getSalesWithDetails } from "@/db/queries/sales";
import { formatPaiseToCurrency } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

interface DashboardCounts {
  totalMedicines: number;
  lowStockCount: number;
  expiringCount: number;
  todaySalesCount: number;
  todayRevenuePaise: number;
}

interface SaleRow extends Sale {
  customerName: string | null;
  userName: string;
  itemCount: number;
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [counts, setCounts] = useState<DashboardCounts | null>(null);
  const [recentSales, setRecentSales] = useState<SaleRow[]>([]);
  const [stockAlerts, setStockAlerts] = useState<StockAlert[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const [dashCounts, sales, alerts] = await Promise.all([
        getDashboardCounts(),
        getSalesWithDetails(10),
        getStockAlerts(),
      ]);
      setCounts(dashCounts);
      setRecentSales(sales);
      setStockAlerts(alerts);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-muted-foreground text-sm">Loading…</p>
      </div>
    );
  }

  const topStockAlerts = stockAlerts.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-600 mt-1">Overview of your pharmacy</p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today's Sales */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Today's Sales
              </CardTitle>
              <ShoppingCart className="size-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">
              {counts?.todaySalesCount ?? 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {formatPaiseToCurrency(counts?.todayRevenuePaise ?? 0)} revenue
            </p>
          </CardContent>
        </Card>

        {/* Total Medicines */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Medicines
              </CardTitle>
              <Pill className="size-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">
              {counts?.totalMedicines ?? 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Active in inventory
            </p>
          </CardContent>
        </Card>

        {/* Low Stock */}
        <Card
          className={
            (counts?.lowStockCount ?? 0) > 0
              ? "cursor-pointer hover:border-red-300 transition-colors"
              : ""
          }
          onClick={
            (counts?.lowStockCount ?? 0) > 0
              ? () => navigate("/inventory/stock-alerts")
              : undefined
          }
        >
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Low Stock Items
              </CardTitle>
              <AlertTriangle
                className={`size-4 ${(counts?.lowStockCount ?? 0) > 0 ? "text-red-500" : "text-muted-foreground"}`}
              />
            </div>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold tabular-nums ${(counts?.lowStockCount ?? 0) > 0 ? "text-red-600" : ""}`}
            >
              {counts?.lowStockCount ?? 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Below reorder level
            </p>
          </CardContent>
        </Card>

        {/* Near-Expiry */}
        <Card
          className={
            (counts?.expiringCount ?? 0) > 0
              ? "cursor-pointer hover:border-amber-300 transition-colors"
              : ""
          }
          onClick={
            (counts?.expiringCount ?? 0) > 0
              ? () => navigate("/reports/expiry")
              : undefined
          }
        >
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Near-Expiry Items
              </CardTitle>
              <Clock
                className={`size-4 ${(counts?.expiringCount ?? 0) > 0 ? "text-amber-500" : "text-muted-foreground"}`}
              />
            </div>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold tabular-nums ${(counts?.expiringCount ?? 0) > 0 ? "text-amber-600" : ""}`}
            >
              {counts?.expiringCount ?? 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Expiring within 90 days
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="flex items-center gap-3">
        <Button onClick={() => navigate("/sales/new")} className="gap-2">
          <Plus className="size-4" />
          New Sale
        </Button>
        <Button
          variant="outline"
          onClick={() => navigate("/inventory/medicines")}
          className="gap-2"
        >
          <Pill className="size-4" />
          Add Medicine
        </Button>
      </div>

      {/* Bottom Grid: Recent Sales + Low Stock */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Sales — 2/3 width */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Recent Sales</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-muted-foreground"
                  onClick={() => navigate("/sales/history")}
                >
                  View all
                  <ArrowRight className="size-3" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {recentSales.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <ReceiptIcon className="size-10 text-muted-foreground/40" />
                  <p className="text-muted-foreground text-sm">
                    No sales recorded yet.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate("/sales/new")}
                  >
                    Create your first sale
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentSales.map((sale) => (
                      <TableRow
                        key={sale.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() =>
                          navigate(`/sales/invoice/${sale.id}`)
                        }
                      >
                        <TableCell className="font-mono font-medium text-sm">
                          {sale.invoiceNumber}
                        </TableCell>
                        <TableCell className="text-slate-600 text-sm whitespace-nowrap">
                          {formatDate(sale.saleDate)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {sale.customerName ?? (
                            <span className="text-muted-foreground">
                              Walk-in
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm font-medium">
                          {formatPaiseToCurrency(sale.grandTotalPaise)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Low Stock Summary — 1/3 width */}
        <div>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Low Stock</CardTitle>
                {stockAlerts.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1 text-muted-foreground"
                    onClick={() => navigate("/inventory/stock-alerts")}
                  >
                    View all
                    <ArrowRight className="size-3" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {topStockAlerts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <PackageOpen className="size-10 text-muted-foreground/40" />
                  <p className="text-muted-foreground text-sm">
                    All items are well-stocked.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {topStockAlerts.map((alert) => (
                    <div
                      key={alert.medicineId}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="font-medium truncate mr-3">
                        {alert.medicineName}
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-red-600 font-semibold tabular-nums">
                          {alert.currentStock}
                        </span>
                        <span className="text-muted-foreground">/</span>
                        <span className="text-muted-foreground tabular-nums">
                          {alert.reorderLevel}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
