import { useState, useEffect } from "react";
import { toast } from "sonner";
import type { Supplier } from "@/types";
import { createSupplier, updateSupplier } from "@/db/queries/suppliers";
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

interface SupplierFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier?: Supplier;
  onSaved: () => void;
}

interface FormState {
  name: string;
  phone: string;
  email: string;
  address: string;
  gstIn: string;
  drugLicenseNo: string;
}

interface FormErrors {
  name?: string;
  email?: string;
  gstIn?: string;
}

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

const DEFAULT_FORM: FormState = {
  name: "",
  phone: "",
  email: "",
  address: "",
  gstIn: "",
  drugLicenseNo: "",
};

export default function SupplierFormDialog({
  open,
  onOpenChange,
  supplier,
  onSaved,
}: SupplierFormDialogProps) {
  const isEditMode = supplier !== undefined;
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);

  // Sync form when dialog opens or supplier changes
  useEffect(() => {
    if (open) {
      if (supplier) {
        setForm({
          name: supplier.name,
          phone: supplier.phone ?? "",
          email: supplier.email ?? "",
          address: supplier.address ?? "",
          gstIn: supplier.gstIn ?? "",
          drugLicenseNo: supplier.drugLicenseNo ?? "",
        });
      } else {
        setForm(DEFAULT_FORM);
      }
      setErrors({});
    }
  }, [open, supplier]);

  function validate(): boolean {
    const newErrors: FormErrors = {};

    if (!form.name.trim()) {
      newErrors.name = "Supplier name is required";
    }

    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      newErrors.email = "Invalid email format";
    }

    if (form.gstIn.trim() && !GSTIN_REGEX.test(form.gstIn.trim())) {
      newErrors.gstIn = "Invalid GSTIN format (15 characters, e.g. 29ABCDE1234F1Z5)";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!validate()) return;

    try {
      setSaving(true);

      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        address: form.address.trim() || null,
        gstIn: form.gstIn.trim() || null,
        drugLicenseNo: form.drugLicenseNo.trim() || null,
      };

      if (isEditMode && supplier) {
        await updateSupplier(supplier.id, payload);
        toast.success("Supplier updated successfully");
      } else {
        await createSupplier(payload);
        toast.success("Supplier created successfully");
      }

      onOpenChange(false);
      onSaved();
    } catch (err) {
      console.error(err);
      toast.error(
        isEditMode ? "Failed to update supplier" : "Failed to create supplier"
      );
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
          <DialogTitle>
            {isEditMode ? "Edit Supplier" : "Add New Supplier"}
          </DialogTitle>
          <DialogDescription>
            {isEditMode
              ? "Update the supplier's information below."
              : "Fill in the details to add a new supplier."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="sup-name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="sup-name"
              value={form.name}
              onChange={(e) => handleFieldChange("name", e.target.value)}
              placeholder="e.g. MedSupply Pvt Ltd"
              aria-invalid={!!errors.name}
              autoComplete="off"
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name}</p>
            )}
          </div>

          {/* Phone */}
          <div className="space-y-1.5">
            <Label htmlFor="sup-phone">Phone</Label>
            <Input
              id="sup-phone"
              value={form.phone}
              onChange={(e) => handleFieldChange("phone", e.target.value)}
              placeholder="e.g. 9876543210"
              autoComplete="off"
            />
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="sup-email">Email</Label>
            <Input
              id="sup-email"
              type="email"
              value={form.email}
              onChange={(e) => handleFieldChange("email", e.target.value)}
              placeholder="e.g. contact@medsupply.com"
              aria-invalid={!!errors.email}
              autoComplete="off"
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email}</p>
            )}
          </div>

          {/* Address */}
          <div className="space-y-1.5">
            <Label htmlFor="sup-address">Address</Label>
            <textarea
              id="sup-address"
              value={form.address}
              onChange={(e) => handleFieldChange("address", e.target.value)}
              placeholder="Full address"
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          {/* GSTIN */}
          <div className="space-y-1.5">
            <Label htmlFor="sup-gstin">GSTIN</Label>
            <Input
              id="sup-gstin"
              value={form.gstIn}
              onChange={(e) =>
                handleFieldChange("gstIn", e.target.value.toUpperCase())
              }
              placeholder="e.g. 29ABCDE1234F1Z5"
              maxLength={15}
              aria-invalid={!!errors.gstIn}
              autoComplete="off"
            />
            {errors.gstIn && (
              <p className="text-sm text-destructive">{errors.gstIn}</p>
            )}
          </div>

          {/* Drug License No */}
          <div className="space-y-1.5">
            <Label htmlFor="sup-license">Drug License No</Label>
            <Input
              id="sup-license"
              value={form.drugLicenseNo}
              onChange={(e) =>
                handleFieldChange("drugLicenseNo", e.target.value)
              }
              placeholder="e.g. KA/WHL/2024/12345"
              autoComplete="off"
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
              {saving
                ? isEditMode
                  ? "Saving..."
                  : "Creating..."
                : isEditMode
                  ? "Save Changes"
                  : "Add Supplier"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
