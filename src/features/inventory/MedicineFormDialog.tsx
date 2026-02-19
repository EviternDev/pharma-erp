import { useState, useEffect } from "react";
import { toast } from "sonner";
import type { MedicineWithGst, GstSlab, DosageForm } from "@/types";
import { createMedicine, updateMedicine } from "@/db/queries/medicines";
import { getGstSlabs } from "@/db/queries/gstSlabs";
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

interface MedicineFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  medicine?: MedicineWithGst;
  onSaved: () => void;
}

interface FormState {
  name: string;
  genericName: string;
  brandName: string;
  manufacturer: string;
  dosageForm: DosageForm;
  strength: string;
  category: string;
  hsnCode: string;
  gstSlabId: string;
  reorderLevel: string;
  isActive: boolean;
}

interface FormErrors {
  name?: string;
  hsnCode?: string;
  gstSlabId?: string;
  reorderLevel?: string;
}

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

const DOSAGE_FORMS: DosageForm[] = [
  "tablet",
  "capsule",
  "syrup",
  "injection",
  "cream",
  "ointment",
  "drops",
  "inhaler",
  "powder",
  "gel",
  "lotion",
  "suspension",
  "other",
];

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

const DEFAULT_FORM: FormState = {
  name: "",
  genericName: "",
  brandName: "",
  manufacturer: "",
  dosageForm: "tablet",
  strength: "",
  category: "",
  hsnCode: "3004",
  gstSlabId: "",
  reorderLevel: "20",
  isActive: true,
};

export default function MedicineFormDialog({
  open,
  onOpenChange,
  medicine,
  onSaved,
}: MedicineFormDialogProps) {
  const isEditMode = medicine !== undefined;
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [gstSlabs, setGstSlabs] = useState<GstSlab[]>([]);
  const [loadingSlabs, setLoadingSlabs] = useState(false);

  // Load GST slabs when dialog opens
  useEffect(() => {
    if (open) {
      setLoadingSlabs(true);
      getGstSlabs()
        .then(setGstSlabs)
        .catch((err) => {
          console.error(err);
          toast.error("Failed to load GST slabs");
        })
        .finally(() => setLoadingSlabs(false));
    }
  }, [open]);

  // Sync form when dialog opens or medicine changes
  useEffect(() => {
    if (open) {
      if (medicine) {
        setForm({
          name: medicine.name,
          genericName: medicine.genericName ?? "",
          brandName: medicine.brandName ?? "",
          manufacturer: medicine.manufacturer ?? "",
          dosageForm: medicine.dosageForm,
          strength: medicine.strength ?? "",
          category: medicine.category ?? "",
          hsnCode: medicine.hsnCode,
          gstSlabId: String(medicine.gstSlabId),
          reorderLevel: String(medicine.reorderLevel),
          isActive: medicine.isActive,
        });
      } else {
        setForm(DEFAULT_FORM);
      }
      setErrors({});
    }
  }, [open, medicine]);

  function validate(): boolean {
    const newErrors: FormErrors = {};

    if (!form.name.trim()) {
      newErrors.name = "Medicine name is required";
    }

    if (!form.hsnCode.trim()) {
      newErrors.hsnCode = "HSN code is required";
    } else if (!/^\d{4,8}$/.test(form.hsnCode.trim())) {
      newErrors.hsnCode = "HSN code must be 4 to 8 digits";
    }

    if (!form.gstSlabId) {
      newErrors.gstSlabId = "GST rate is required";
    }

    const reorderNum = Number(form.reorderLevel);
    if (form.reorderLevel !== "" && (isNaN(reorderNum) || reorderNum < 0)) {
      newErrors.reorderLevel = "Reorder level must be a non-negative number";
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
        genericName: form.genericName.trim() || null,
        brandName: form.brandName.trim() || null,
        manufacturer: form.manufacturer.trim() || null,
        dosageForm: form.dosageForm,
        strength: form.strength.trim() || null,
        category: form.category || null,
        hsnCode: form.hsnCode.trim(),
        gstSlabId: Number(form.gstSlabId),
        reorderLevel: form.reorderLevel === "" ? 20 : Number(form.reorderLevel),
      };

      if (isEditMode && medicine) {
        await updateMedicine(medicine.id, {
          ...payload,
          isActive: form.isActive,
        });
        toast.success("Medicine updated successfully");
      } else {
        await createMedicine(payload);
        toast.success("Medicine created successfully");
      }

      onOpenChange(false);
      onSaved();
    } catch (err) {
      console.error(err);
      toast.error(
        isEditMode ? "Failed to update medicine" : "Failed to create medicine"
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
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? "Edit Medicine" : "Add New Medicine"}
          </DialogTitle>
          <DialogDescription>
            {isEditMode
              ? "Update the medicine details below."
              : "Fill in the details to add a new medicine to inventory."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="med-name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="med-name"
              value={form.name}
              onChange={(e) => handleFieldChange("name", e.target.value)}
              placeholder="e.g. Paracetamol"
              aria-invalid={!!errors.name}
              autoComplete="off"
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name}</p>
            )}
          </div>

          {/* Generic Name */}
          <div className="space-y-1.5">
            <Label htmlFor="med-generic-name">Generic Name</Label>
            <Input
              id="med-generic-name"
              value={form.genericName}
              onChange={(e) =>
                handleFieldChange("genericName", e.target.value)
              }
              placeholder="e.g. Acetaminophen"
              autoComplete="off"
            />
          </div>

          {/* Brand Name */}
          <div className="space-y-1.5">
            <Label htmlFor="med-brand-name">Brand Name</Label>
            <Input
              id="med-brand-name"
              value={form.brandName}
              onChange={(e) => handleFieldChange("brandName", e.target.value)}
              placeholder="e.g. Crocin"
              autoComplete="off"
            />
          </div>

          {/* Manufacturer */}
          <div className="space-y-1.5">
            <Label htmlFor="med-manufacturer">Manufacturer</Label>
            <Input
              id="med-manufacturer"
              value={form.manufacturer}
              onChange={(e) =>
                handleFieldChange("manufacturer", e.target.value)
              }
              placeholder="e.g. GSK Pharma"
              autoComplete="off"
            />
          </div>

          {/* Dosage Form + Strength row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="med-dosage-form">Dosage Form</Label>
              <Select
                value={form.dosageForm}
                onValueChange={(val) =>
                  handleFieldChange("dosageForm", val as DosageForm)
                }
              >
                <SelectTrigger id="med-dosage-form" className="w-full">
                  <SelectValue placeholder="Select form" />
                </SelectTrigger>
                <SelectContent>
                  {DOSAGE_FORMS.map((f) => (
                    <SelectItem key={f} value={f}>
                      {DOSAGE_FORM_LABELS[f]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="med-strength">Strength</Label>
              <Input
                id="med-strength"
                value={form.strength}
                onChange={(e) => handleFieldChange("strength", e.target.value)}
                placeholder="e.g. 500mg"
                autoComplete="off"
              />
            </div>
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <Label htmlFor="med-category">Category</Label>
            <Select
              value={form.category}
              onValueChange={(val) => handleFieldChange("category", val)}
            >
              <SelectTrigger id="med-category" className="w-full">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* HSN Code + GST Rate row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="med-hsn">
                HSN Code <span className="text-destructive">*</span>
              </Label>
              <Input
                id="med-hsn"
                value={form.hsnCode}
                onChange={(e) => handleFieldChange("hsnCode", e.target.value)}
                placeholder="e.g. 3004"
                aria-invalid={!!errors.hsnCode}
                autoComplete="off"
              />
              {errors.hsnCode && (
                <p className="text-sm text-destructive">{errors.hsnCode}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="med-gst">
                GST Rate <span className="text-destructive">*</span>
              </Label>
              <Select
                value={form.gstSlabId}
                onValueChange={(val) => handleFieldChange("gstSlabId", val)}
                disabled={loadingSlabs}
              >
                <SelectTrigger
                  id="med-gst"
                  className="w-full"
                  aria-invalid={!!errors.gstSlabId}
                >
                  <SelectValue
                    placeholder={loadingSlabs ? "Loading…" : "Select rate"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {gstSlabs.map((slab) => (
                    <SelectItem key={slab.id} value={String(slab.id)}>
                      {slab.rate}%
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.gstSlabId && (
                <p className="text-sm text-destructive">{errors.gstSlabId}</p>
              )}
            </div>
          </div>

          {/* Reorder Level */}
          <div className="space-y-1.5">
            <Label htmlFor="med-reorder">Reorder Level</Label>
            <Input
              id="med-reorder"
              type="number"
              min="0"
              value={form.reorderLevel}
              onChange={(e) =>
                handleFieldChange("reorderLevel", e.target.value)
              }
              placeholder="20"
              aria-invalid={!!errors.reorderLevel}
            />
            {errors.reorderLevel && (
              <p className="text-sm text-destructive">{errors.reorderLevel}</p>
            )}
          </div>

          {/* Active Status — edit mode only */}
          {isEditMode && (
            <div className="flex items-center gap-3">
              <input
                id="med-active"
                type="checkbox"
                checked={form.isActive}
                onChange={(e) =>
                  handleFieldChange("isActive", e.target.checked)
                }
                className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
              />
              <Label htmlFor="med-active" className="cursor-pointer font-normal">
                Medicine is active
              </Label>
            </div>
          )}

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
                  ? "Saving…"
                  : "Creating…"
                : isEditMode
                  ? "Save Changes"
                  : "Add Medicine"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
