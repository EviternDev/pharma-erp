import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  PlusIcon,
  PencilIcon,
  SearchIcon,
  PackageIcon,
  PackageCheckIcon,
  PackageXIcon,
} from "lucide-react";
import type { MedicineWithGst, GstSlab, DosageForm } from "@/types";
import {
  getMedicinesWithGst,
  searchMedicines,
  updateMedicine,
} from "@/db/queries/medicines";
import { getGstSlabs } from "@/db/queries/gstSlabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import MedicineFormDialog from "./MedicineFormDialog";

const DOSAGE_FORM_LABELS: Record<DosageForm, string> = {
  tablet: "Tablet",
  capsule: "Capsule",
  syrup: "Syrup",
  injection: "Injection",
  cream: "Cream",
  ointment: "Ointment",
  drops: "Drops",
  inhaler: "Inhaler",
  powder: "Powder",
  gel: "Gel",
  lotion: "Lotion",
  suspension: "Suspension",
  other: "Other",
};

const CATEGORY_OPTIONS = [
  { value: "antibiotic", label: "Antibiotic" },
  { value: "analgesic", label: "Analgesic" },
  { value: "antiviral", label: "Antiviral" },
  { value: "antifungal", label: "Antifungal" },
  { value: "vitamin", label: "Vitamin" },
  { value: "cardiac", label: "Cardiac" },
  { value: "diabetic", label: "Diabetic" },
  { value: "other", label: "Other" },
];

function capitalize(str: string | null): string {
  if (!str) return "—";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export default function MedicinesPage() {
  const [medicines, setMedicines] = useState<MedicineWithGst[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [gstFilter, setGstFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMedicine, setEditingMedicine] = useState<
    MedicineWithGst | undefined
  >(undefined);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [gstSlabs, setGstSlabs] = useState<GstSlab[]>([]);

  const fetchMedicines = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getMedicinesWithGst(true);
      setMedicines(data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load medicines");
    } finally {
      setLoading(false);
    }
  }, []);

  // Load GST slabs for filter dropdown
  useEffect(() => {
    getGstSlabs()
      .then(setGstSlabs)
      .catch((err) => {
        console.error(err);
      });
  }, []);

  // Initial load
  useEffect(() => {
    fetchMedicines();
  }, [fetchMedicines]);

  // Debounced search
  useEffect(() => {
    if (!searchTerm.trim()) {
      fetchMedicines();
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        const results = await searchMedicines(searchTerm.trim());
        setMedicines(results);
      } catch (err) {
        console.error(err);
        toast.error("Search failed");
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm, fetchMedicines]);

  // Client-side filtering for category and GST rate
  const filteredMedicines = medicines.filter((m) => {
    if (categoryFilter !== "all" && m.category !== categoryFilter) return false;
    if (gstFilter !== "all" && String(m.gstRate) !== gstFilter) return false;
    return true;
  });

  function openCreateDialog() {
    setEditingMedicine(undefined);
    setDialogOpen(true);
  }

  function openEditDialog(medicine: MedicineWithGst) {
    setEditingMedicine(medicine);
    setDialogOpen(true);
  }

  async function handleToggleActive(medicine: MedicineWithGst) {
    setTogglingId(medicine.id);
    try {
      await updateMedicine(medicine.id, { isActive: !medicine.isActive });
      toast.success(
        medicine.isActive
          ? `${medicine.name} has been deactivated`
          : `${medicine.name} has been activated`
      );
      await fetchMedicines();
    } catch (err) {
      console.error(err);
      toast.error("Failed to update medicine status");
    } finally {
      setTogglingId(null);
    }
  }

  async function handleSaved() {
    setSearchTerm("");
    setCategoryFilter("all");
    setGstFilter("all");
    await fetchMedicines();
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Medicines</h1>
          <p className="text-slate-600 mt-1">
            Manage medicine inventory records
          </p>
        </div>
        <Button onClick={openCreateDialog} className="gap-2">
          <PlusIcon className="size-4" />
          Add Medicine
        </Button>
      </div>

      {/* Search and filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative max-w-sm flex-1 min-w-[200px]">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, brand or generic name..."
            className="pl-9"
            aria-label="Search medicines"
          />
        </div>

        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORY_OPTIONS.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={gstFilter} onValueChange={setGstFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="GST Rate" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All GST Rates</SelectItem>
            {gstSlabs.map((slab) => (
              <SelectItem key={slab.id} value={String(slab.rate)}>
                {slab.rate}%
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <p className="text-muted-foreground text-sm">
              Loading medicines...
            </p>
          </div>
        ) : filteredMedicines.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <PackageIcon className="size-10 text-muted-foreground/40" />
            <p className="text-muted-foreground text-sm">
              {searchTerm.trim() ||
              categoryFilter !== "all" ||
              gstFilter !== "all"
                ? "No medicines match your filters."
                : "No medicines yet."}
            </p>
            {!searchTerm.trim() &&
              categoryFilter === "all" &&
              gstFilter === "all" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={openCreateDialog}
                >
                  Add the first medicine
                </Button>
              )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Brand</TableHead>
                <TableHead>Manufacturer</TableHead>
                <TableHead>Form</TableHead>
                <TableHead>Strength</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>HSN</TableHead>
                <TableHead>GST</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMedicines.map((m) => (
                <TableRow
                  key={m.id}
                  className={!m.isActive ? "opacity-60" : undefined}
                >
                  <TableCell className="font-medium">
                    <div>
                      {m.name}
                      {m.genericName && (
                        <span className="block text-xs text-muted-foreground">
                          {m.genericName}
                        </span>
                      )}
                    </div>
                  </TableCell>

                  <TableCell className="text-slate-600 text-sm">
                    {m.brandName ?? "—"}
                  </TableCell>

                  <TableCell className="text-slate-600 text-sm">
                    {m.manufacturer ?? "—"}
                  </TableCell>

                  <TableCell className="text-slate-600 text-sm">
                    {DOSAGE_FORM_LABELS[m.dosageForm] ?? m.dosageForm}
                  </TableCell>

                  <TableCell className="text-slate-600 text-sm">
                    {m.strength ?? "—"}
                  </TableCell>

                  <TableCell className="text-slate-600 text-sm">
                    {capitalize(m.category)}
                  </TableCell>

                  <TableCell className="text-slate-600 text-sm font-mono">
                    {m.hsnCode}
                  </TableCell>

                  <TableCell className="text-slate-600 text-sm">
                    {m.gstRate}%
                  </TableCell>

                  <TableCell>
                    {m.isActive ? (
                      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">
                        Active
                      </Badge>
                    ) : (
                      <Badge
                        variant="secondary"
                        className="bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-100"
                      >
                        Inactive
                      </Badge>
                    )}
                  </TableCell>

                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => openEditDialog(m)}
                        title="Edit medicine"
                      >
                        <PencilIcon className="size-4" />
                        <span className="sr-only">Edit</span>
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleToggleActive(m)}
                        disabled={togglingId === m.id}
                        title={
                          m.isActive
                            ? "Deactivate medicine"
                            : "Activate medicine"
                        }
                        className={
                          m.isActive
                            ? "text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                            : "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                        }
                      >
                        {m.isActive ? (
                          <PackageXIcon className="size-4" />
                        ) : (
                          <PackageCheckIcon className="size-4" />
                        )}
                        <span className="sr-only">
                          {m.isActive ? "Deactivate" : "Activate"}
                        </span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <MedicineFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        medicine={editingMedicine}
        onSaved={handleSaved}
      />
    </div>
  );
}
