import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeftIcon, PlusIcon, TruckIcon } from "lucide-react";
import type { Supplier, SupplierPayment } from "@/types";
import {
  getSupplierById,
  getSupplierPayments,
} from "@/db/queries/suppliers";
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
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import PaymentFormDialog from "./PaymentFormDialog";

const PAYMENT_MODE_LABELS: Record<string, string> = {
  cash: "Cash",
  upi: "UPI",
  card: "Cheque",
  credit: "NEFT",
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function SupplierDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [payments, setPayments] = useState<SupplierPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);

  const supplierId = id ? parseInt(id, 10) : NaN;

  const fetchData = useCallback(async () => {
    if (isNaN(supplierId)) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const [sup, pays] = await Promise.all([
        getSupplierById(supplierId),
        getSupplierPayments(supplierId),
      ]);

      if (!sup) {
        setNotFound(true);
      } else {
        setSupplier(sup);
        setPayments(pays);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load supplier details");
    } finally {
      setLoading(false);
    }
  }, [supplierId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalPayments = payments.reduce((sum, p) => sum + p.amountPaise, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-muted-foreground text-sm">Loading supplier details…</p>
      </div>
    );
  }

  if (notFound || !supplier) {
    return (
      <div className="space-y-6">
        <Button
          variant="ghost"
          size="sm"
          className="gap-2 text-slate-600"
          onClick={() => navigate("/suppliers")}
        >
          <ArrowLeftIcon className="size-4" />
          Back to Suppliers
        </Button>
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <TruckIcon className="size-12 text-muted-foreground/40" />
          <p className="text-slate-600 text-base font-medium">Supplier not found</p>
          <Button variant="outline" size="sm" onClick={() => navigate("/suppliers")}>
            Return to Suppliers
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button
        variant="ghost"
        size="sm"
        className="gap-2 text-slate-600 -ml-2"
        onClick={() => navigate("/suppliers")}
      >
        <ArrowLeftIcon className="size-4" />
        Back to Suppliers
      </Button>

      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{supplier.name}</h1>
          <p className="text-slate-600 mt-1">Supplier details and payment history</p>
        </div>
        <Button className="gap-2" onClick={() => setPaymentDialogOpen(true)}>
          <PlusIcon className="size-4" />
          Record Payment
        </Button>
      </div>

      {/* Supplier info card + Total payments */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Info card */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-slate-900">
              Supplier Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <div>
                <dt className="text-slate-500 font-medium">Phone</dt>
                <dd className="text-slate-900 mt-0.5">
                  {supplier.phone ?? <span className="text-slate-400">—</span>}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 font-medium">Email</dt>
                <dd className="text-slate-900 mt-0.5">
                  {supplier.email ?? <span className="text-slate-400">—</span>}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 font-medium">GSTIN</dt>
                <dd className="text-slate-900 mt-0.5 font-mono">
                  {supplier.gstIn ?? <span className="text-slate-400">—</span>}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 font-medium">Drug License No</dt>
                <dd className="text-slate-900 mt-0.5">
                  {supplier.drugLicenseNo ?? (
                    <span className="text-slate-400">—</span>
                  )}
                </dd>
              </div>
              {supplier.address && (
                <div className="sm:col-span-2">
                  <dt className="text-slate-500 font-medium">Address</dt>
                  <dd className="text-slate-900 mt-0.5 whitespace-pre-line">
                    {supplier.address}
                  </dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>

        {/* Total payments summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold text-slate-900">
              Total Payments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-slate-900 tabular-nums">
              {formatPaiseToCurrency(totalPayments)}
            </p>
            <Separator className="my-3" />
            <p className="text-sm text-slate-500">
              {payments.length === 0
                ? "No payments recorded yet"
                : `${payments.length} payment${payments.length === 1 ? "" : "s"} recorded`}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Payment history */}
      <div>
        <h2 className="text-lg font-semibold text-slate-900 mb-3">
          Payment History
        </h2>
        <div className="rounded-lg border bg-card shadow-sm">
          {payments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <p className="text-muted-foreground text-sm">
                No payments recorded yet.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPaymentDialogOpen(true)}
              >
                Record the first payment
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Amount (₹)</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-sm text-slate-600">
                      {formatDate(p.paymentDate)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm font-medium">
                      {formatPaiseToCurrency(p.amountPaise)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {PAYMENT_MODE_LABELS[p.paymentMode] ?? p.paymentMode}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">
                      {p.reference ?? <span className="text-slate-400">—</span>}
                    </TableCell>
                    <TableCell className="text-sm text-slate-600 max-w-[200px] truncate">
                      {p.notes ?? <span className="text-slate-400">—</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      <PaymentFormDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        supplierId={supplier.id}
        onSaved={fetchData}
      />
    </div>
  );
}
