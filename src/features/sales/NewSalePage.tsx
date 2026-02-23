import { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  SearchIcon,
  Trash2Icon,
  ShoppingCartIcon,
  UserIcon,
  XIcon,
  FileTextIcon,
} from "lucide-react";
import type { Customer, PaymentMode, MedicineWithGst } from "@/types";
import { searchMedicines } from "@/db/queries/medicines";
import { getBatchesFEFO } from "@/db/queries/batches";
import { searchCustomers } from "@/db/queries/customers";
import {
  createSale,
  type CreateSaleData,
  type CreateSaleItemData,
} from "@/db/queries/sales";
import { createPrescription } from "@/db/queries/prescriptions";
import {
  calculateLineItem,
  calculateInvoiceTotal,
  validateNotAboveMrp,
  type SaleItemCalculation,
} from "@/lib/gst";
import {
  formatPaiseToCurrency,
  paiseToRupeesString,
  rupeesToPaise,
} from "@/lib/currency";
import { useAuth } from "@/features/auth/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface CartItem {
  medicineId: number;
  medicineName: string;
  batchId: number;
  batchNumber: string;
  expiryDate: string;
  unitPricePaise: number;
  mrpPaise: number;
  costPricePaise: number;
  quantity: number;
  maxQuantity: number;
  gstRate: number;
  discountPaise: number;
  hsnCode: string;
  calculation: SaleItemCalculation;
}

interface PrescriptionData {
  doctorName: string;
  rxNumber: string;
  prescriptionDate: string;
  notes: string;
}

function formatExpiry(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export default function NewSalePage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Medicine search
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<
    (MedicineWithGst & { stock: number })[]
  >([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Cart
  const [cart, setCart] = useState<CartItem[]>([]);

  // Customer
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null
  );
  const [showCustomerResults, setShowCustomerResults] = useState(false);
  const customerRef = useRef<HTMLDivElement>(null);

  // Prescription
  const [showPrescription, setShowPrescription] = useState(false);
  const [prescription, setPrescription] = useState<PrescriptionData>({
    doctorName: "",
    rxNumber: "",
    prescriptionDate: new Date().toISOString().split("T")[0],
    notes: "",
  });

  // Payment
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("cash");

  // Checkout
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        searchRef.current &&
        !searchRef.current.contains(e.target as Node)
      ) {
        setShowResults(false);
      }
      if (
        customerRef.current &&
        !customerRef.current.contains(e.target as Node)
      ) {
        setShowCustomerResults(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Medicine search debounce
  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setSearchLoading(true);
        const medicines = await searchMedicines(searchTerm.trim());
        const withStock = await Promise.all(
          medicines.map(async (m) => {
            const batches = await getBatchesFEFO(m.id);
            const stock = batches.reduce((sum, b) => sum + b.quantity, 0);
            return { ...m, stock };
          })
        );
        setSearchResults(withStock);
        setShowResults(true);
      } catch (err) {
        console.error(err);
        toast.error("Search failed");
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Customer search debounce
  useEffect(() => {
    if (!customerSearch.trim()) {
      setCustomerResults([]);
      setShowCustomerResults(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const results = await searchCustomers(customerSearch.trim());
        setCustomerResults(results);
        setShowCustomerResults(true);
      } catch {
        void 0; // debounced customer search failure — non-critical
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [customerSearch]);

  // Add medicine to cart
  const addToCart = useCallback(
    async (medicine: MedicineWithGst & { stock: number }) => {
      if (medicine.stock <= 0) {
        toast.error(`${medicine.name} is out of stock`);
        return;
      }

      // Check if already in cart
      const existing = cart.find((item) => item.medicineId === medicine.id);
      if (existing) {
        // Increment quantity if possible
        if (existing.quantity < existing.maxQuantity) {
          updateQuantity(
            cart.indexOf(existing),
            existing.quantity + 1
          );
        } else {
          toast.error(`Maximum stock reached for ${medicine.name}`);
        }
        setSearchTerm("");
        setShowResults(false);
        return;
      }

      try {
        const batches = await getBatchesFEFO(medicine.id);
        if (batches.length === 0) {
          toast.error(`No available batches for ${medicine.name}`);
          return;
        }

        const batch = batches[0];

        if (!validateNotAboveMrp(batch.sellingPricePaise, batch.mrpPaise)) {
          toast.error(
            `${medicine.name}: Selling price exceeds MRP. Update batch before selling.`
          );
          return;
        }
        const calc = calculateLineItem(
          batch.sellingPricePaise,
          1,
          medicine.gstRate,
          0
        );
        const newItem: CartItem = {
          medicineId: medicine.id,
          medicineName: medicine.name,
          batchId: batch.id,
          batchNumber: batch.batchNumber,
          expiryDate: batch.expiryDate,
          unitPricePaise: batch.sellingPricePaise,
          mrpPaise: batch.mrpPaise,
          costPricePaise: batch.costPricePaise,
          quantity: 1,
          maxQuantity: batch.quantity,
          gstRate: medicine.gstRate,
          discountPaise: 0,
          hsnCode: medicine.hsnCode,
          calculation: calc,
        };

        setCart((prev) => [...prev, newItem]);
        setSearchTerm("");
        setShowResults(false);

      } catch (err) {
        console.error(err);
        toast.error("Failed to add item");
      }
    },
    [cart]
  );

  // Update item quantity
  const updateQuantity = useCallback(
    (index: number, newQty: number) => {
      setCart((prev) => {
        const updated = [...prev];
        const item = { ...updated[index] };
        const qty = Math.max(1, Math.min(newQty, item.maxQuantity));
        item.quantity = qty;
        item.calculation = calculateLineItem(
          item.unitPricePaise,
          qty,
          item.gstRate,
          item.discountPaise
        );
        updated[index] = item;
        return updated;
      });
    },
    []
  );

  // Update item discount
  const updateDiscount = useCallback(
    (index: number, discountRupees: string) => {
      setCart((prev) => {
        const updated = [...prev];
        const item = { ...updated[index] };
        // Clamp discount: must be >= 0 and cannot make effective price negative
        const rawDiscount = rupeesToPaise(discountRupees);
        item.discountPaise = Math.max(0, Math.min(rawDiscount, item.unitPricePaise * item.quantity));
        item.calculation = calculateLineItem(
          item.unitPricePaise,
          item.quantity,
          item.gstRate,
          item.discountPaise
        );
        updated[index] = item;
        return updated;
      });
    },
    []
  );

  // Remove item from cart
  const removeItem = useCallback((index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Invoice totals
  const invoiceTotals = calculateInvoiceTotal(
    cart.map((item) => item.calculation)
  );

  // Checkout
  async function handleCheckout() {
    if (!user) {
      toast.error("Not authenticated");
      return;
    }

    // Final MRP guard before committing to DB
    const mrpViolation = cart.find(
      (item) => !validateNotAboveMrp(item.unitPricePaise, item.mrpPaise)
    );
    if (mrpViolation) {
      toast.error(
        `Cannot complete sale: ${mrpViolation.medicineName} price exceeds MRP`
      );
      setConfirmOpen(false);
      return;
    }

    setProcessing(true);
    try {

      const items: CreateSaleItemData[] = cart.map((item) => ({
        batchId: item.batchId,
        medicineId: item.medicineId,
        quantity: item.quantity,
        unitPricePaise: item.unitPricePaise,
        discountPaise: item.discountPaise,
        taxableAmountPaise: item.calculation.taxableAmountPaise,
        cgstRate: item.calculation.cgstRate,
        cgstAmountPaise: item.calculation.cgstAmountPaise,
        sgstRate: item.calculation.sgstRate,
        sgstAmountPaise: item.calculation.sgstAmountPaise,
        totalPaise: item.calculation.totalPaise,
        hsnCode: item.hsnCode,
      }));

      const saleData: CreateSaleData = {
        customerId: selectedCustomer?.id ?? null,
        userId: user.id,
        subtotalPaise: invoiceTotals.subtotalPaise,
        discountPaise: invoiceTotals.discountPaise,
        totalCgstPaise: invoiceTotals.totalCgstPaise,
        totalSgstPaise: invoiceTotals.totalSgstPaise,
        totalGstPaise: invoiceTotals.totalGstPaise,
        grandTotalPaise: invoiceTotals.grandTotalPaise,
        paymentMode,
        items,
      };

      const saleId = await createSale(saleData);

      // Create prescription if filled
      if (
        showPrescription &&
        selectedCustomer &&
        prescription.doctorName.trim()
      ) {
        await createPrescription({
          customerId: selectedCustomer.id,
          saleId,
          doctorName: prescription.doctorName.trim(),
          rxNumber: prescription.rxNumber.trim() || null,
          prescriptionDate: prescription.prescriptionDate,
          notes: prescription.notes.trim() || null,
        });
      }

      toast.success(`Sale completed`);
      setConfirmOpen(false);
      setCart([]);
      setSelectedCustomer(null);
      setShowPrescription(false);
      setPrescription({
        doctorName: "",
        rxNumber: "",
        prescriptionDate: new Date().toISOString().split("T")[0],
        notes: "",
      });
      navigate(`/sales/invoice/${saleId}`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to complete sale");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold text-slate-900">New Sale</h1>

      <div className="flex gap-6 items-start">
        {/* Left panel — search + cart */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Medicine search */}
          <div ref={searchRef} className="relative">
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search medicines by name, brand, or generic name\u2026"
                className="pl-9 text-base"
                autoFocus
              />
            </div>

            {showResults && searchResults.length > 0 && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg max-h-72 overflow-y-auto">
                {searchResults.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 text-left border-b last:border-b-0"
                    onClick={() => addToCart(m)}
                    disabled={m.stock <= 0}
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-sm text-slate-900 truncate">
                        {m.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {m.brandName ?? m.genericName ?? m.manufacturer ?? ""}
                        {m.gstRate > 0 ? ` \u00b7 GST ${m.gstRate}%` : " \u00b7 GST Exempt"}
                      </p>
                    </div>
                    <div className="text-right shrink-0 ml-4">
                      <p
                        className={`text-sm font-medium ${
                          m.stock <= 0
                            ? "text-red-500"
                            : "text-slate-900"
                        }`}
                      >
                        Stock: {m.stock}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {showResults &&
              searchResults.length === 0 &&
              !searchLoading &&
              searchTerm.trim() && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg p-4 text-center">
                  <p className="text-muted-foreground text-sm">
                    No medicines found
                  </p>
                </div>
              )}
          </div>

          {/* Cart table */}
          <div className="rounded-lg border bg-card shadow-sm">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <ShoppingCartIcon className="size-10 text-muted-foreground/40" />
                <p className="text-muted-foreground text-sm">
                  Search for medicines above to add items to the cart.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[180px]">Medicine</TableHead>
                      <TableHead>Batch</TableHead>
                      <TableHead>Expiry</TableHead>
                      <TableHead className="w-20">Qty</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="w-24">Discount</TableHead>
                      <TableHead className="text-right">GST%</TableHead>
                      <TableHead className="text-right">CGST</TableHead>
                      <TableHead className="text-right">SGST</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cart.map((item, idx) => (
                      <TableRow key={`${item.batchId}-${idx}`}>
                        <TableCell className="font-medium text-sm">
                          {item.medicineName}
                        </TableCell>
                        <TableCell className="text-xs font-mono text-slate-600">
                          {item.batchNumber}
                        </TableCell>
                        <TableCell className="text-xs text-slate-600 whitespace-nowrap">
                          {formatExpiry(item.expiryDate)}
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={1}
                            max={item.maxQuantity}
                            value={item.quantity}
                            onChange={(e) =>
                              updateQuantity(idx, Number(e.target.value))
                            }
                            className="w-16 h-8 text-center text-sm"
                          />
                          {item.quantity >= item.maxQuantity && (
                            <p className="text-[10px] text-amber-600 mt-0.5">
                              Max {item.maxQuantity}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">
                          {formatPaiseToCurrency(item.unitPricePaise)}
                        </TableCell>
                        <TableCell>
                          <Input
                            type="text"
                            value={
                              item.discountPaise > 0
                                ? paiseToRupeesString(item.discountPaise)
                                : ""
                            }
                            onChange={(e) =>
                              updateDiscount(idx, e.target.value)
                            }
                            placeholder="0.00"
                            className="w-20 h-8 text-right text-sm"
                          />
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-xs text-slate-600">
                          {item.gstRate}%
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-xs text-slate-600">
                          {formatPaiseToCurrency(
                            item.calculation.cgstAmountPaise
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-xs text-slate-600">
                          {formatPaiseToCurrency(
                            item.calculation.sgstAmountPaise
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm font-medium">
                          {formatPaiseToCurrency(item.calculation.totalPaise)}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => removeItem(idx)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2Icon className="size-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>

        {/* Right panel — customer, payment, summary */}
        <div className="w-80 shrink-0 space-y-4">
          {/* Customer selection */}
          <Card className="p-4 space-y-3">
            <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Customer
            </Label>
            {selectedCustomer ? (
              <div className="flex items-center justify-between bg-slate-50 rounded-md px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <UserIcon className="size-4 text-slate-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {selectedCustomer.name}
                    </p>
                    {selectedCustomer.phone && (
                      <p className="text-xs text-muted-foreground">
                        {selectedCustomer.phone}
                      </p>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => {
                    setSelectedCustomer(null);
                    setShowPrescription(false);
                  }}
                >
                  <XIcon className="size-3" />
                </Button>
              </div>
            ) : (
              <div ref={customerRef} className="relative">
                <Input
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  placeholder="Search customer (optional)\u2026"
                  className="text-sm"
                />
                {showCustomerResults && customerResults.length > 0 && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {customerResults.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-50 text-left border-b last:border-b-0"
                        onClick={() => {
                          setSelectedCustomer(c);
                          setCustomerSearch("");
                          setShowCustomerResults(false);
                        }}
                      >
                        <span className="text-sm font-medium">{c.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {c.phone ?? ""}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <p className="text-[11px] text-muted-foreground">
              Leave blank for walk-in customer
            </p>
          </Card>

          {/* Prescription (only when customer is selected) */}
          {selectedCustomer && (
            <Card className="p-4 space-y-3">
              {!showPrescription ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2"
                  onClick={() => setShowPrescription(true)}
                >
                  <FileTextIcon className="size-4" />
                  Add Prescription
                </Button>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Prescription
                    </Label>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setShowPrescription(false)}
                    >
                      <XIcon className="size-3" />
                    </Button>
                  </div>
                  <Input
                    value={prescription.doctorName}
                    onChange={(e) =>
                      setPrescription((p) => ({
                        ...p,
                        doctorName: e.target.value,
                      }))
                    }
                    placeholder="Doctor Name *"
                    className="text-sm h-8"
                  />
                  <Input
                    value={prescription.rxNumber}
                    onChange={(e) =>
                      setPrescription((p) => ({
                        ...p,
                        rxNumber: e.target.value,
                      }))
                    }
                    placeholder="Rx Number"
                    className="text-sm h-8"
                  />
                  <Input
                    type="date"
                    value={prescription.prescriptionDate}
                    onChange={(e) =>
                      setPrescription((p) => ({
                        ...p,
                        prescriptionDate: e.target.value,
                      }))
                    }
                    className="text-sm h-8"
                  />
                </div>
              )}
            </Card>
          )}

          {/* Payment mode */}
          <Card className="p-4 space-y-3">
            <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Payment Mode
            </Label>
            <div className="flex gap-2">
              {(["cash", "upi", "card"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={`flex-1 py-2 px-3 rounded-md text-sm font-medium border transition-colors ${
                    paymentMode === mode
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  }`}
                  onClick={() => setPaymentMode(mode)}
                >
                  {mode === "cash" ? "Cash" : mode === "upi" ? "UPI" : "Card"}
                </button>
              ))}
            </div>
          </Card>

          {/* Cart summary */}
          <Card className="p-4 space-y-2">
            <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Summary
            </Label>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Subtotal</span>
                <span className="tabular-nums">
                  {formatPaiseToCurrency(invoiceTotals.subtotalPaise)}
                </span>
              </div>
              {invoiceTotals.discountPaise > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount</span>
                  <span className="tabular-nums">
                    -{formatPaiseToCurrency(invoiceTotals.discountPaise)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-slate-600">
                <span>CGST</span>
                <span className="tabular-nums">
                  {formatPaiseToCurrency(invoiceTotals.totalCgstPaise)}
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>SGST</span>
                <span className="tabular-nums">
                  {formatPaiseToCurrency(invoiceTotals.totalSgstPaise)}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between font-bold text-lg pt-1">
                <span className="text-slate-900">Grand Total</span>
                <span className="tabular-nums text-slate-900">
                  {formatPaiseToCurrency(invoiceTotals.grandTotalPaise)}
                </span>
              </div>
            </div>
          </Card>

          {/* Checkout button */}
          <Button
            className="w-full h-12 text-base font-semibold gap-2"
            disabled={cart.length === 0 || processing}
            onClick={() => setConfirmOpen(true)}
          >
            <ShoppingCartIcon className="size-5" />
            Complete Sale
          </Button>
        </div>
      </div>

      {/* Confirmation dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Sale</DialogTitle>
            <DialogDescription>
              Complete sale of{" "}
              <span className="font-semibold text-slate-900">
                {formatPaiseToCurrency(invoiceTotals.grandTotalPaise)}
              </span>{" "}
              for {cart.length} item{cart.length !== 1 ? "s" : ""}?
              {selectedCustomer && (
                <>
                  <br />
                  Customer: {selectedCustomer.name}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={processing}
            >
              Cancel
            </Button>
            <Button onClick={handleCheckout} disabled={processing}>
              {processing ? "Processing\u2026" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
