import { useState, useEffect } from "react";
import { toast } from "sonner";
import type { Customer } from "@/types";
import { createCustomer, updateCustomer } from "@/db/queries/customers";
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

interface CustomerFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer?: Customer;
  onSaved: () => void;
}

interface FormState {
  name: string;
  phone: string;
  email: string;
  address: string;
}

interface FormErrors {
  name?: string;
  email?: string;
}

const DEFAULT_FORM: FormState = {
  name: "",
  phone: "",
  email: "",
  address: "",
};

export default function CustomerFormDialog({
  open,
  onOpenChange,
  customer,
  onSaved,
}: CustomerFormDialogProps) {
  const isEditMode = customer !== undefined;
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);

  // Sync form when dialog opens or customer changes
  useEffect(() => {
    if (open) {
      if (customer) {
        setForm({
          name: customer.name,
          phone: customer.phone ?? "",
          email: customer.email ?? "",
          address: customer.address ?? "",
        });
      } else {
        setForm(DEFAULT_FORM);
      }
      setErrors({});
    }
  }, [open, customer]);

  function validate(): boolean {
    const newErrors: FormErrors = {};

    if (!form.name.trim()) {
      newErrors.name = "Customer name is required";
    }

    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      newErrors.email = "Invalid email format";
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
      };

      if (isEditMode && customer) {
        await updateCustomer(customer.id, payload);
        toast.success("Customer updated successfully");
      } else {
        await createCustomer(payload);
        toast.success("Customer created successfully");
      }

      onOpenChange(false);
      onSaved();
    } catch (err) {
      console.error(err);
      toast.error(
        isEditMode ? "Failed to update customer" : "Failed to create customer"
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
            {isEditMode ? "Edit Customer" : "Add New Customer"}
          </DialogTitle>
          <DialogDescription>
            {isEditMode
              ? "Update the customer's information below."
              : "Fill in the details to add a new customer."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="cust-name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="cust-name"
              value={form.name}
              onChange={(e) => handleFieldChange("name", e.target.value)}
              placeholder="e.g. Rajesh Kumar"
              aria-invalid={!!errors.name}
              autoComplete="off"
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name}</p>
            )}
          </div>

          {/* Phone */}
          <div className="space-y-1.5">
            <Label htmlFor="cust-phone">Phone</Label>
            <Input
              id="cust-phone"
              value={form.phone}
              onChange={(e) => handleFieldChange("phone", e.target.value)}
              placeholder="e.g. 9876543210"
              autoComplete="off"
            />
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="cust-email">Email</Label>
            <Input
              id="cust-email"
              type="email"
              value={form.email}
              onChange={(e) => handleFieldChange("email", e.target.value)}
              placeholder="e.g. rajesh@example.com"
              aria-invalid={!!errors.email}
              autoComplete="off"
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email}</p>
            )}
          </div>

          {/* Address */}
          <div className="space-y-1.5">
            <Label htmlFor="cust-address">Address</Label>
            <textarea
              id="cust-address"
              value={form.address}
              onChange={(e) => handleFieldChange("address", e.target.value)}
              placeholder="Full address"
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
              {saving
                ? isEditMode
                  ? "Saving..."
                  : "Creating..."
                : isEditMode
                  ? "Save Changes"
                  : "Add Customer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
