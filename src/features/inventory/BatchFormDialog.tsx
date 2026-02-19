import { useState, useEffect } from "react";
import { toast } from "sonner";
import { createBatch } from "@/db/queries/batches";
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

interface BatchFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  medicineId: number;
  medicineName: string;
  onSaved: () => void;
}

interface FormState {
  batchNumber: string;
  manufacturingDate: string;
  expiryDate: string;
  costPrice: string;
  mrp: string;
  sellingPrice: string;
  quantity: string;
}

interface FormErrors {
  batchNumber?: string;
  expiryDate?: string;
  costPrice?: string;
  mrp?: string;
  sellingPrice?: string;
  quantity?: string;
}

const DEFAULT_FORM: FormState = {
  batchNumber: "",
  manufacturingDate: "",
  expiryDate: "",
  costPrice: "",
  mrp: "",
  sellingPrice: "",
  quantity: "",
};

export default function BatchFormDialog({
  open,
  onOpenChange,
  medicineId,
  medicineName,
  onSaved,
}: BatchFormDialogProps) {
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setForm(DEFAULT_FORM);
      setErrors({});
    }
  }, [open]);

  function validate(): boolean {
    const newErrors: FormErrors = {};

    if (!form.batchNumber.trim()) {
      newErrors.batchNumber = "Batch number is required";
    }

    if (!form.expiryDate) {
      newErrors.expiryDate = "Expiry date is required";
    } else {
      const expiry = new Date(form.expiryDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (expiry <= today) {
        newErrors.expiryDate = "Expiry date must be in the future";
      }
    }

    const mrpNum = parseFloat(form.mrp);
    if (!form.mrp || isNaN(mrpNum) || mrpNum <= 0) {
      newErrors.mrp = "MRP must be greater than 0";
    }

    const sellingNum = parseFloat(form.sellingPrice);
    if (!form.sellingPrice || isNaN(sellingNum) || sellingNum <= 0) {
      newErrors.sellingPrice = "Selling price must be greater than 0";
    } else if (!isNaN(mrpNum) && sellingNum > mrpNum) {
      newErrors.sellingPrice = "Selling price cannot exceed MRP";
    }

    const costNum = parseFloat(form.costPrice);
    if (!form.costPrice || isNaN(costNum) || costNum < 0) {
      newErrors.costPrice = "Cost price must be a non-negative number";
    }

    const qtyNum = parseInt(form.quantity, 10);
    if (!form.quantity || isNaN(qtyNum) || qtyNum <= 0) {
      newErrors.quantity = "Quantity must be greater than 0";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!validate()) return;

    try {
      setSaving(true);

      await createBatch({
        medicineId,
        batchNumber: form.batchNumber.trim(),
        expiryDate: form.expiryDate,
        costPricePaise: rupeesToPaise(form.costPrice),
        mrpPaise: rupeesToPaise(form.mrp),
        sellingPricePaise: rupeesToPaise(form.sellingPrice),
        quantity: parseInt(form.quantity, 10),
        manufacturingDate: form.manufacturingDate || null,
      });

      toast.success("Batch added successfully");
      onOpenChange(false);
      onSaved();
    } catch (err) {
      console.error(err);
      const errMsg = String(err);
      if (errMsg.includes("CHECK")) {
        toast.error("Selling price cannot exceed MRP (database constraint)");
      } else {
        toast.error("Failed to add batch");
      }
    } finally {
      setSaving(false);
    }
  }

  function handleFieldChange<K extends keyof FormState>(
    field: K,
    value: FormState[K]
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
          <DialogTitle>Add New Batch</DialogTitle>
          <DialogDescription>
            Add a batch for{" "}
            <span className="font-medium">{medicineName}</span>. All prices in
            rupees.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Batch Number */}
          <div className="space-y-1.5">
            <Label htmlFor="batch-number">
              Batch Number <span className="text-destructive">*</span>
            </Label>
            <Input
              id="batch-number"
              value={form.batchNumber}
              onChange={(e) =>
                handleFieldChange("batchNumber", e.target.value)
              }
              placeholder="e.g. BN-2025-001"
              aria-invalid={!!errors.batchNumber}
              autoComplete="off"
            />
            {errors.batchNumber && (
              <p className="text-sm text-destructive">{errors.batchNumber}</p>
            )}
          </div>

          {/* Dates row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="batch-mfg-date">Mfg Date</Label>
              <Input
                id="batch-mfg-date"
                type="date"
                value={form.manufacturingDate}
                onChange={(e) =>
                  handleFieldChange("manufacturingDate", e.target.value)
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="batch-expiry-date">
                Expiry Date <span className="text-destructive">*</span>
              </Label>
              <Input
                id="batch-expiry-date"
                type="date"
                value={form.expiryDate}
                onChange={(e) =>
                  handleFieldChange("expiryDate", e.target.value)
                }
                aria-invalid={!!errors.expiryDate}
              />
              {errors.expiryDate && (
                <p className="text-sm text-destructive">{errors.expiryDate}</p>
              )}
            </div>
          </div>

          {/* Price row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="batch-cost">
                Cost Price <span className="text-destructive">*</span>
              </Label>
              <Input
                id="batch-cost"
                type="number"
                step="0.01"
                min="0"
                value={form.costPrice}
                onChange={(e) =>
                  handleFieldChange("costPrice", e.target.value)
                }
                placeholder="0.00"
                aria-invalid={!!errors.costPrice}
              />
              {errors.costPrice && (
                <p className="text-sm text-destructive">{errors.costPrice}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="batch-mrp">
                MRP <span className="text-destructive">*</span>
              </Label>
              <Input
                id="batch-mrp"
                type="number"
                step="0.01"
                min="0.01"
                value={form.mrp}
                onChange={(e) => handleFieldChange("mrp", e.target.value)}
                placeholder="0.00"
                aria-invalid={!!errors.mrp}
              />
              {errors.mrp && (
                <p className="text-sm text-destructive">{errors.mrp}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="batch-selling">
                Selling Price <span className="text-destructive">*</span>
              </Label>
              <Input
                id="batch-selling"
                type="number"
                step="0.01"
                min="0.01"
                value={form.sellingPrice}
                onChange={(e) =>
                  handleFieldChange("sellingPrice", e.target.value)
                }
                placeholder="0.00"
                aria-invalid={!!errors.sellingPrice}
              />
              {errors.sellingPrice && (
                <p className="text-sm text-destructive">
                  {errors.sellingPrice}
                </p>
              )}
            </div>
          </div>

          {/* Quantity */}
          <div className="space-y-1.5">
            <Label htmlFor="batch-qty">
              Initial Quantity <span className="text-destructive">*</span>
            </Label>
            <Input
              id="batch-qty"
              type="number"
              min="1"
              value={form.quantity}
              onChange={(e) => handleFieldChange("quantity", e.target.value)}
              placeholder="e.g. 100"
              aria-invalid={!!errors.quantity}
            />
            {errors.quantity && (
              <p className="text-sm text-destructive">{errors.quantity}</p>
            )}
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
              {saving ? "Adding..." : "Add Batch"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
