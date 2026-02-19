import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { PlusIcon, PencilIcon, SearchIcon, UsersIcon } from "lucide-react";
import type { Customer } from "@/types";
import {
  getCustomersWithStats,
  searchCustomers,
  type CustomerWithStats,
} from "@/db/queries/customers";
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
import CustomerFormDialog from "./CustomerFormDialog";

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<CustomerWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<
    Customer | undefined
  >(undefined);

  const fetchAllCustomers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getCustomersWithStats();
      setCustomers(data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load customers");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchAllCustomers();
  }, [fetchAllCustomers]);

  // Debounced search
  useEffect(() => {
    if (!searchTerm.trim()) {
      fetchAllCustomers();
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        const results = await searchCustomers(searchTerm.trim());
        // searchCustomers returns Customer[], wrap with placeholder stats
        const withStats: CustomerWithStats[] = results.map((c) => ({
          ...c,
          totalPurchases: 0,
          lastPurchaseDate: null,
        }));
        setCustomers(withStats);
      } catch (err) {
        console.error(err);
        toast.error("Search failed");
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm, fetchAllCustomers]);

  function openCreateDialog() {
    setEditingCustomer(undefined);
    setDialogOpen(true);
  }

  function openEditDialog(customer: CustomerWithStats) {
    setEditingCustomer(customer);
    setDialogOpen(true);
  }

  async function handleSaved() {
    setSearchTerm("");
    await fetchAllCustomers();
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Customers</h1>
          <p className="text-slate-600 mt-1">Manage customer records</p>
        </div>
        <Button onClick={openCreateDialog} className="gap-2">
          <PlusIcon className="size-4" />
          Add Customer
        </Button>
      </div>

      {/* Search bar */}
      <div className="relative max-w-sm">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
        <Input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by name, phone or email…"
          className="pl-9"
          aria-label="Search customers"
        />
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <p className="text-muted-foreground text-sm">Loading customers…</p>
          </div>
        ) : customers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <UsersIcon className="size-10 text-muted-foreground/40" />
            <p className="text-muted-foreground text-sm">
              {searchTerm.trim()
                ? "No customers match your search."
                : "No customers yet."}
            </p>
            {!searchTerm.trim() && (
              <Button variant="outline" size="sm" onClick={openCreateDialog}>
                Add the first customer
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
                <TableHead>Address</TableHead>
                <TableHead className="text-right">Total Purchases</TableHead>
                <TableHead>Last Purchase</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>

                  <TableCell className="text-slate-600 text-sm">
                    {c.phone ?? "—"}
                  </TableCell>

                  <TableCell className="text-slate-600 text-sm">
                    {c.email ?? "—"}
                  </TableCell>

                  <TableCell className="text-slate-600 text-sm max-w-[200px] truncate">
                    {c.address ?? "—"}
                  </TableCell>

                  <TableCell className="text-right tabular-nums">
                    {c.totalPurchases}
                  </TableCell>

                  <TableCell className="text-slate-600 text-sm whitespace-nowrap">
                    {formatDate(c.lastPurchaseDate)}
                  </TableCell>

                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => openEditDialog(c)}
                      title="Edit customer"
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

      <CustomerFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        customer={editingCustomer}
        onSaved={handleSaved}
      />
    </div>
  );
}
