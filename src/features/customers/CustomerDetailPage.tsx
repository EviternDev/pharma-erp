import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeftIcon,
  UserIcon,
  PhoneIcon,
  MailIcon,
  MapPinIcon,
  FileTextIcon,
} from "lucide-react";
import type { Customer, Sale, Prescription } from "@/types";
import { getCustomerById } from "@/db/queries/customers";
import { getSalesByCustomer } from "@/db/queries/sales";
import { getPrescriptionsByCustomer } from "@/db/queries/prescriptions";
import { formatPaiseToCurrency } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "\u2014";
  try {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "\u2014";
  }
}

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    const customerId = Number(id);
    if (!customerId || isNaN(customerId)) {
      toast.error("Invalid customer ID");
      navigate("/customers");
      return;
    }

    try {
      setLoading(true);
      const [cust, salesData, rxData] = await Promise.all([
        getCustomerById(customerId),
        getSalesByCustomer(customerId),
        getPrescriptionsByCustomer(customerId),
      ]);

      if (!cust) {
        toast.error("Customer not found");
        navigate("/customers");
        return;
      }

      setCustomer(cust);
      setSales(salesData);
      setPrescriptions(rxData);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load customer details");
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-muted-foreground text-sm">Loading customer details\u2026</p>
      </div>
    );
  }

  if (!customer) return null;

  return (
    <div className="space-y-6">
      {/* Back button + header */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/customers")}
          className="gap-1 text-muted-foreground mb-2"
        >
          <ArrowLeftIcon className="size-4" />
          Back to Customers
        </Button>
        <h1 className="text-3xl font-bold text-slate-900">{customer.name}</h1>
      </div>

      {/* Customer info card */}
      <Card className="p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="flex items-start gap-3">
            <PhoneIcon className="size-4 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Phone</p>
              <p className="text-sm text-slate-800">{customer.phone ?? "\u2014"}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <MailIcon className="size-4 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Email</p>
              <p className="text-sm text-slate-800">{customer.email ?? "\u2014"}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <MapPinIcon className="size-4 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Address</p>
              <p className="text-sm text-slate-800">{customer.address ?? "\u2014"}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <UserIcon className="size-4 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Member Since</p>
              <p className="text-sm text-slate-800">{formatDate(customer.createdAt)}</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Purchase History */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">Purchase History</h2>
          <Badge variant="secondary">{sales.length} purchases</Badge>
        </div>

        <div className="rounded-lg border bg-card shadow-sm">
          {sales.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <p className="text-muted-foreground text-sm">
                No purchases recorded yet.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales.map((sale) => (
                  <TableRow
                    key={sale.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/sales/invoice/${sale.id}`)}
                  >
                    <TableCell className="text-slate-600 text-sm whitespace-nowrap">
                      {formatDate(sale.saleDate)}
                    </TableCell>
                    <TableCell className="font-medium font-mono text-sm">
                      {sale.invoiceNumber}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize text-xs">
                        {sale.paymentMode}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm font-medium">
                      {formatPaiseToCurrency(sale.grandTotalPaise)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      <Separator />

      {/* Prescriptions */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">Prescriptions</h2>
          <Badge variant="secondary">{prescriptions.length} prescriptions</Badge>
        </div>

        <div className="rounded-lg border bg-card shadow-sm">
          {prescriptions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <FileTextIcon className="size-8 text-muted-foreground/40" />
              <p className="text-muted-foreground text-sm">
                No prescriptions linked yet.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Doctor</TableHead>
                  <TableHead>Rx Number</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {prescriptions.map((rx) => (
                  <TableRow key={rx.id}>
                    <TableCell className="text-slate-600 text-sm whitespace-nowrap">
                      {formatDate(rx.prescriptionDate)}
                    </TableCell>
                    <TableCell className="font-medium text-sm">
                      {rx.doctorName}
                    </TableCell>
                    <TableCell className="text-slate-600 text-sm font-mono">
                      {rx.rxNumber ?? "\u2014"}
                    </TableCell>
                    <TableCell className="text-slate-600 text-sm max-w-[300px] truncate">
                      {rx.notes ?? "\u2014"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </div>
  );
}
