import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { useSearchParams } from "react-router-dom";
import {
  PlusIcon,
  PackageIcon,
} from "lucide-react";
import type { Batch, MedicineWithGst } from "@/types";
import {
  getBatchesByMedicine,
} from "@/db/queries/batches";
import { getMedicineById, getMedicinesWithGst } from "@/db/queries/medicines";
import { formatPaiseToCurrency } from "@/lib/currency";
import { useSettings } from "@/hooks/useSettings";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import BatchFormDialog from "./BatchFormDialog";

function daysBetween(dateStr: string): number {
  const expiry = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  expiry.setHours(0, 0, 0, 0);
  return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

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

export default function BatchesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedMedicineId = searchParams.get("medicineId");

  const { settings } = useSettings();
  const nearExpiryDays = settings?.nearExpiryDays ?? 90;

  const [medicines, setMedicines] = useState<MedicineWithGst[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [medicineName, setMedicineName] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);

  // Load medicines list for selector
  useEffect(() => {
    getMedicinesWithGst()
      .then(setMedicines)
      .catch((err) => {
        console.error(err);
        toast.error("Failed to load medicines");
      });
  }, []);

  const fetchBatches = useCallback(async () => {
    if (!selectedMedicineId) {
      setBatches([]);
      setMedicineName("");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const medId = Number(selectedMedicineId);
      const [batchData, medicine] = await Promise.all([
        getBatchesByMedicine(medId, true),
        getMedicineById(medId),
      ]);
      setBatches(batchData);
      setMedicineName(medicine?.name ?? "Unknown Medicine");
    } catch (err) {
      console.error(err);
      toast.error("Failed to load batches");
    } finally {
      setLoading(false);
    }
  }, [selectedMedicineId]);

  useEffect(() => {
    fetchBatches();
  }, [fetchBatches]);

  function handleMedicineSelect(value: string) {
    if (value === "none") {
      setSearchParams({});
    } else {
      setSearchParams({ medicineId: value });
    }
  }

  function getRowClass(batch: Batch): string {
    const days = daysBetween(batch.expiryDate);
    if (days <= 0) return "bg-red-50";
    if (days <= nearExpiryDays) return "bg-amber-50";
    return "";
  }

  function getExpiryBadge(batch: Batch) {
    const days = daysBetween(batch.expiryDate);
    if (days <= 0) {
      return (
        <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100">
          Expired
        </Badge>
      );
    }
    if (days <= nearExpiryDays) {
      return (
        <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100">
          {days}d left
        </Badge>
      );
    }
    return (
      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">
        Active
      </Badge>
    );
  }

  async function handleSaved() {
    await fetchBatches();
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Batches</h1>
          <p className="text-slate-600 mt-1">
            Manage batch and lot records per medicine
          </p>
        </div>
        {selectedMedicineId && (
          <Button onClick={() => setDialogOpen(true)} className="gap-2">
            <PlusIcon className="size-4" />
            Add Batch
          </Button>
        )}
      </div>

      {/* Medicine selector */}
      <div className="max-w-sm">
        <Select
          value={selectedMedicineId ?? "none"}
          onValueChange={handleMedicineSelect}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a medicine..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Select a medicine...</SelectItem>
            {medicines.map((m) => (
              <SelectItem key={m.id} value={String(m.id)}>
                {m.name}
                {m.strength ? ` (${m.strength})` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!selectedMedicineId ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <PackageIcon className="size-10 text-muted-foreground/40" />
          <p className="text-muted-foreground text-sm">
            Select a medicine above to view its batches.
          </p>
        </div>
      ) : (
        <>
          {medicineName && (
            <p className="text-sm text-slate-500">
              Showing batches for{" "}
              <span className="font-medium text-slate-700">{medicineName}</span>
            </p>
          )}

          {/* Batches table */}
          <div className="rounded-lg border bg-card shadow-sm">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <p className="text-muted-foreground text-sm">
                  Loading batches...
                </p>
              </div>
            ) : batches.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <PackageIcon className="size-10 text-muted-foreground/40" />
                <p className="text-muted-foreground text-sm">
                  No batches recorded for this medicine.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDialogOpen(true)}
                >
                  Add the first batch
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Batch #</TableHead>
                    <TableHead>Mfg Date</TableHead>
                    <TableHead>Expiry Date</TableHead>
                    <TableHead className="text-right">Cost Price</TableHead>
                    <TableHead className="text-right">MRP</TableHead>
                    <TableHead className="text-right">Selling Price</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batches.map((b) => (
                    <TableRow key={b.id} className={getRowClass(b)}>
                      <TableCell className="font-mono text-sm font-medium">
                        {b.batchNumber}
                      </TableCell>

                      <TableCell className="text-slate-600 text-sm whitespace-nowrap">
                        {formatDate(b.manufacturingDate)}
                      </TableCell>

                      <TableCell className="text-slate-600 text-sm whitespace-nowrap">
                        {formatDate(b.expiryDate)}
                      </TableCell>

                      <TableCell className="text-right tabular-nums text-sm">
                        {formatPaiseToCurrency(b.costPricePaise)}
                      </TableCell>

                      <TableCell className="text-right tabular-nums text-sm">
                        {formatPaiseToCurrency(b.mrpPaise)}
                      </TableCell>

                      <TableCell className="text-right tabular-nums text-sm">
                        {formatPaiseToCurrency(b.sellingPricePaise)}
                      </TableCell>

                      <TableCell className="text-right tabular-nums text-sm font-medium">
                        {b.quantity}
                      </TableCell>

                      <TableCell>{getExpiryBadge(b)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </>
      )}

      {selectedMedicineId && (
        <BatchFormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          medicineId={Number(selectedMedicineId)}
          medicineName={medicineName}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
