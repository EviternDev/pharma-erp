import { useState, useEffect } from "react";
import { toast } from "sonner";
import type { PaymentMode } from "@/types";
import type { SupplierPaymentFormData } from "@/types/forms";
import { createSupplierPayment } from "@/db/queries/suppliers";
import { rupeesToPaise } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PaymentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplierId: number;
  onSaved: () => void;
}

interface FormErrors {
  amount?: string;
  paymentDate?: string;
}

const PAYMENT_MODE_OPTIONS: { value: PaymentMode; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "upi", label: "UPI" },
  { value: "card", label: "Cheque" },
  { value: "credit", label: "NEFT" },
];

function todayIso(): string {
  return new Date().toISOString().split("T")[0];
}

const DEFAULT_FORM: SupplierPaymentFormData = {
  supplierId: "",
  amount: "",
  paymentDate: todayIso(),
  paymentMode: "cash",
  reference: "",
  notes: "",
};

export default function PaymentFormDialog({
  open,
  onOpenChange,
  supplierId,
  onSaved,
}: PaymentFormDialogProps) {
  const [form, setForm] = useState<SupplierPaymentFormData>({
    ...DEFAULT_FORM,
    supplierId,
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setForm({ ...DEFAULT_FORM, supplierId, paymentDate: todayIso() });
      setErrors({});
    }
  }, [open, supplierId]);

  function validate(): boolean {
    const newErrors: FormErrors = {};

    const amountPaise = rupeesToPaise(form.amount);
    if (!form.amount.trim()) {
      newErrors.amount = "Amount is required";
    } else if (amountPaise <= 0) {
      newErrors.amount = "Amount must be greater than zero";
    }

    if (!form.paymentDate) {
      newErrors.paymentDate = "Payment date is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    try {
      setSaving(true);
      await createSupplierPayment({
        supplierId,
        amountPaise: rupeesToPaise(form.amount),
        paymentDate: form.paymentDate,
        paymentMode: form.paymentMode,
        reference: form.reference.trim() || null,
        notes: form.notes.trim() || null,
      });
      toast.success("Payment recorded");
      onOpenChange(false);
      onSaved();
    } catch (err) {
      console.error(err);
      toast.error("Failed to record payment");
    } finally {
      setSaving(false);
    }
  }

  function handleFieldChange<K extends keyof SupplierPaymentFormData>(
    field: K,
    value: SupplierPaymentFormData[K]
  ) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field as keyof FormErrors];
        return next;
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
          <DialogDescription>
            Record a payment made to this supplier.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Amount */}
          <div className="space-y-1.5">
            <Label htmlFor="pay-amount">
              Amount (₹) <span className="text-destructive">*</span>
            </Label>
            <Input
              id="pay-amount"
              type="number"
              min="0.01"
              step="0.01"
              value={form.amount}
              onChange={(e) => handleFieldChange("amount", e.target.value)}
              placeholder="e.g. 5000.00"
              aria-invalid={!!errors.amount}
              autoComplete="off"
            />
            {errors.amount && (
              <p className="text-sm text-destructive">{errors.amount}</p>
            )}
          </div>

          {/* Payment Date */}
          <div className="space-y-1.5">
            <Label htmlFor="pay-date">
              Payment Date <span className="text-destructive">*</span>
            </Label>
            <Input
              id="pay-date"
              type="date"
              value={form.paymentDate}
              onChange={(e) => handleFieldChange("paymentDate", e.target.value)}
              aria-invalid={!!errors.paymentDate}
            />
            {errors.paymentDate && (
              <p className="text-sm text-destructive">{errors.paymentDate}</p>
            )}
          </div>

          {/* Payment Mode */}
          <div className="space-y-1.5">
            <Label htmlFor="pay-mode">Payment Mode</Label>
            <Select
              value={form.paymentMode}
              onValueChange={(value) =>
                handleFieldChange("paymentMode", value as PaymentMode)
              }
            >
              <SelectTrigger id="pay-mode">
                <SelectValue placeholder="Select mode" />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_MODE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Reference / Transaction ID */}
          <div className="space-y-1.5">
            <Label htmlFor="pay-reference">Reference / Transaction ID</Label>
            <Input
              id="pay-reference"
              value={form.reference}
              onChange={(e) => handleFieldChange("reference", e.target.value)}
              placeholder="e.g. UTR12345678 (optional)"
              autoComplete="off"
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="pay-notes">Notes</Label>
            <textarea
              id="pay-notes"
              value={form.notes}
              onChange={(e) => handleFieldChange("notes", e.target.value)}
              placeholder="Optional notes"
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Record Payment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
