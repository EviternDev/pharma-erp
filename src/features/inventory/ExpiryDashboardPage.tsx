import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { CalendarClock, ChevronDown, ChevronRight } from "lucide-react";
import { getDb } from "@/db/index";
import { useSettings } from "@/hooks/useSettings";
import { formatPaiseToCurrency } from "@/lib/currency";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ExpiryBatchRow {
  id: number;
  medicine_name: string;
  batch_number: string;
  expiry_date: string;
  days_until_expiry: number;
  quantity: number;
  cost_price_paise: number;
}

async function getExpiryBatches(): Promise<ExpiryBatchRow[]> {
  const db = await getDb();
  const rows = await db.select<ExpiryBatchRow[]>(`
    SELECT b.id, m.name as medicine_name, b.batch_number, b.expiry_date,
      CAST(julianday(b.expiry_date) - julianday('now') AS INTEGER) as days_until_expiry,
      b.quantity, b.cost_price_paise
    FROM batches b
    JOIN medicines m ON b.medicine_id = m.id
    WHERE b.quantity > 0
    ORDER BY b.expiry_date ASC
  `);
  return rows;
}

interface ExpirySection {
  key: string;
  label: string;
  borderColor: string;
  badgeClass: string;
  headerTextClass: string;
  batches: ExpiryBatchRow[];
  totalValue: number;
  defaultExpanded: boolean;
}

function formatExpiryDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDaysRemaining(days: number): string {
  if (days < 0) {
    const absDays = Math.abs(days);
    return `${absDays}d overdue`;
  }
  if (days === 0) return "Today";
  return `${days}d`;
}

export default function ExpiryDashboardPage() {
  const [batches, setBatches] = useState<ExpiryBatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["expired", "within30"])
  );
  const { settings } = useSettings();

  const nearExpiryDays = settings?.nearExpiryDays ?? 90;

  const fetchBatches = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getExpiryBatches();
      setBatches(data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load expiry data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBatches();
  }, [fetchBatches]);

  const sections: ExpirySection[] = useMemo(() => {
    const expired: ExpiryBatchRow[] = [];
    const within30: ExpiryBatchRow[] = [];
    const withinNear: ExpiryBatchRow[] = [];
    const within6m: ExpiryBatchRow[] = [];

    for (const batch of batches) {
      const days = batch.days_until_expiry;
      if (days < 0) {
        expired.push(batch);
      } else if (days <= 30) {
        within30.push(batch);
      } else if (days <= nearExpiryDays) {
        withinNear.push(batch);
      } else if (days <= 180) {
        within6m.push(batch);
      }
    }

    const calcTotal = (items: ExpiryBatchRow[]) =>
      items.reduce((sum, b) => sum + b.quantity * b.cost_price_paise, 0);

    return [
      {
        key: "expired",
        label: "Expired",
        borderColor: "border-l-red-500",
        badgeClass: "bg-red-100 text-red-700 border-red-200 hover:bg-red-100",
        headerTextClass: "text-red-700",
        batches: expired,
        totalValue: calcTotal(expired),
        defaultExpanded: true,
      },
      {
        key: "within30",
        label: "Expiring within 30 days",
        borderColor: "border-l-orange-500",
        badgeClass:
          "bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-100",
        headerTextClass: "text-orange-700",
        batches: within30,
        totalValue: calcTotal(within30),
        defaultExpanded: true,
      },
      {
        key: "withinNear",
        label: `Expiring within ${nearExpiryDays} days`,
        borderColor: "border-l-amber-500",
        badgeClass:
          "bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100",
        headerTextClass: "text-amber-700",
        batches: withinNear,
        totalValue: calcTotal(withinNear),
        defaultExpanded: false,
      },
      {
        key: "within6m",
        label: "Expiring within 6 months",
        borderColor: "border-l-blue-500",
        badgeClass:
          "bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100",
        headerTextClass: "text-blue-700",
        batches: within6m,
        totalValue: calcTotal(within6m),
        defaultExpanded: false,
      },
    ];
  }, [batches, nearExpiryDays]);

  function toggleSection(key: string) {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            Expiry Dashboard
          </h1>
          <p className="text-slate-600 mt-1">
            Track medicine batches approaching expiry
          </p>
        </div>
        <div className="flex items-center justify-center py-16">
          <p className="text-muted-foreground text-sm">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Expiry Dashboard</h1>
        <p className="text-slate-600 mt-1">
          Track medicine batches approaching expiry
        </p>
      </div>

      {/* Sections */}
      {sections.map((section) => {
        const isExpanded = expandedSections.has(section.key);

        return (
          <Card
            key={section.key}
            className={`border-l-4 ${section.borderColor} py-0 gap-0`}
          >
            <CardHeader className="pb-0 pt-4">
              <button
                onClick={() => toggleSection(section.key)}
                className="flex items-center justify-between w-full text-left"
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? (
                    <ChevronDown size={16} className="text-slate-500" />
                  ) : (
                    <ChevronRight size={16} className="text-slate-500" />
                  )}
                  <CardTitle className="text-base">
                    {section.label}
                  </CardTitle>
                  <Badge className={section.badgeClass}>
                    {section.batches.length}
                  </Badge>
                </div>
                <span className="text-sm text-slate-500 tabular-nums">
                  {formatPaiseToCurrency(section.totalValue)}
                </span>
              </button>
            </CardHeader>

            {isExpanded && (
              <CardContent className="pt-4 pb-2">
                {section.batches.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-2">
                    <CalendarClock className="size-8 text-muted-foreground/40" />
                    <p className="text-muted-foreground text-sm">
                      No batches in this category
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Medicine Name</TableHead>
                        <TableHead>Batch #</TableHead>
                        <TableHead>Expiry Date</TableHead>
                        <TableHead className="text-right">
                          Days Remaining
                        </TableHead>
                        <TableHead className="text-right">
                          Qty Available
                        </TableHead>
                        <TableHead className="text-right">
                          Value at Cost (₹)
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {section.batches.map((batch) => (
                        <TableRow key={batch.id}>
                          <TableCell className="font-medium">
                            {batch.medicine_name}
                          </TableCell>
                          <TableCell className="text-slate-600">
                            {batch.batch_number}
                          </TableCell>
                          <TableCell className="tabular-nums">
                            {formatExpiryDate(batch.expiry_date)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            <span
                              className={
                                batch.days_until_expiry < 0
                                  ? "text-red-600 font-medium"
                                  : batch.days_until_expiry <= 30
                                    ? "text-orange-600 font-medium"
                                    : "text-slate-600"
                              }
                            >
                              {formatDaysRemaining(batch.days_until_expiry)}
                            </span>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {batch.quantity}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatPaiseToCurrency(
                              batch.quantity * batch.cost_price_paise
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
