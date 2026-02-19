import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { PlusIcon, PencilIcon, SearchIcon, TruckIcon } from "lucide-react";
import type { Supplier } from "@/types";
import {
  getSuppliersWithPayments,
  searchSuppliers,
  type SupplierWithPayments,
} from "@/db/queries/suppliers";
import { formatPaiseToCurrency } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import SupplierFormDialog from "./SupplierFormDialog";

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<SupplierWithPayments[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<
    Supplier | undefined
  >(undefined);

  const fetchAllSuppliers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getSuppliersWithPayments();
      setSuppliers(data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load suppliers");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchAllSuppliers();
  }, [fetchAllSuppliers]);

  // Debounced search
  useEffect(() => {
    if (!searchTerm.trim()) {
      fetchAllSuppliers();
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        const results = await searchSuppliers(searchTerm.trim());
        // searchSuppliers returns Supplier[], wrap with placeholder stats
        const withPayments: SupplierWithPayments[] = results.map((s) => ({
          ...s,
          totalPayments: 0,
        }));
        setSuppliers(withPayments);
      } catch (err) {
        console.error(err);
        toast.error("Search failed");
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm, fetchAllSuppliers]);

  function openCreateDialog() {
    setEditingSupplier(undefined);
    setDialogOpen(true);
  }

  function openEditDialog(supplier: SupplierWithPayments) {
    setEditingSupplier(supplier);
    setDialogOpen(true);
  }

  async function handleSaved() {
    setSearchTerm("");
    await fetchAllSuppliers();
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Suppliers</h1>
          <p className="text-slate-600 mt-1">Manage supplier directory</p>
        </div>
        <Button onClick={openCreateDialog} className="gap-2">
          <PlusIcon className="size-4" />
          Add Supplier
        </Button>
      </div>

      {/* Search bar */}
      <div className="relative max-w-sm">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
        <Input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by name, phone or GSTIN..."
          className="pl-9"
          aria-label="Search suppliers"
        />
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <p className="text-muted-foreground text-sm">
              Loading suppliers...
            </p>
          </div>
        ) : suppliers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <TruckIcon className="size-10 text-muted-foreground/40" />
            <p className="text-muted-foreground text-sm">
              {searchTerm.trim()
                ? "No suppliers match your search."
                : "No suppliers yet."}
            </p>
            {!searchTerm.trim() && (
              <Button variant="outline" size="sm" onClick={openCreateDialog}>
                Add the first supplier
              </Button>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>GSTIN</TableHead>
                <TableHead>Drug License</TableHead>
                <TableHead className="text-right">Total Payments</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>

                  <TableCell className="text-slate-600 text-sm">
                    {s.phone ?? "\u2014"}
                  </TableCell>

                  <TableCell className="text-slate-600 text-sm">
                    {s.email ?? "\u2014"}
                  </TableCell>

                  <TableCell className="text-slate-600 text-sm font-mono">
                    {s.gstIn ?? "\u2014"}
                  </TableCell>

                  <TableCell className="text-slate-600 text-sm">
                    {s.drugLicenseNo ?? "\u2014"}
                  </TableCell>

                  <TableCell className="text-right tabular-nums text-sm">
                    {formatPaiseToCurrency(s.totalPayments)}
                  </TableCell>

                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => openEditDialog(s)}
                      title="Edit supplier"
                    >
                      <PencilIcon className="size-4" />
                      <span className="sr-only">Edit</span>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <SupplierFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        supplier={editingSupplier}
        onSaved={handleSaved}
      />
    </div>
  );
}
