import { useState, useEffect } from "react";
import bcrypt from "bcryptjs";
import { toast } from "sonner";
import type { User, UserRole } from "@/types";
import { createUser, updateUser } from "@/db/queries/users";
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

interface UserFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: User;
  onSaved: () => void;
}

interface FormState {
  username: string;
  fullName: string;
  password: string;
  role: UserRole;
  isActive: boolean;
}

interface FormErrors {
  username?: string;
  fullName?: string;
  password?: string;
  role?: string;
}

const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  pharmacist: "Pharmacist",
  cashier: "Cashier",
};

const DEFAULT_FORM: FormState = {
  username: "",
  fullName: "",
  password: "",
  role: "cashier",
  isActive: true,
};

export default function UserFormDialog({
  open,
  onOpenChange,
  user,
  onSaved,
}: UserFormDialogProps) {
  const isEditMode = user !== undefined;
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);

  // Sync form when dialog opens or user changes
  useEffect(() => {
    if (open) {
      if (user) {
        setForm({
          username: user.username,
          fullName: user.fullName,
          password: "",
          role: user.role,
          isActive: user.isActive,
        });
      } else {
        setForm(DEFAULT_FORM);
      }
      setErrors({});
    }
  }, [open, user]);

  function validate(): boolean {
    const newErrors: FormErrors = {};

    if (!form.username.trim()) {
      newErrors.username = "Username is required";
    }

    if (!form.fullName.trim()) {
      newErrors.fullName = "Full name is required";
    }

    if (!isEditMode) {
      if (!form.password) {
        newErrors.password = "Password is required";
      } else if (form.password.length < 6) {
        newErrors.password = "Password must be at least 6 characters";
      }
    } else if (form.password && form.password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!validate()) return;

    try {
      setSaving(true);

      if (isEditMode && user) {
        const payload: {
          fullName?: string;
          role?: UserRole;
          isActive?: boolean;
          passwordHash?: string;
        } = {
          fullName: form.fullName.trim(),
          role: form.role,
          isActive: form.isActive,
        };

        if (form.password) {
          payload.passwordHash = await bcrypt.hash(form.password, 10);
        }

        await updateUser(user.id, payload);
        toast.success("User updated successfully");
      } else {
        const passwordHash = await bcrypt.hash(form.password, 10);
        await createUser(
          form.username.trim(),
          passwordHash,
          form.fullName.trim(),
          form.role
        );
        toast.success("User created successfully");
      }

      onOpenChange(false);
      onSaved();
    } catch (err) {
      console.error(err);
      toast.error(
        isEditMode ? "Failed to update user" : "Failed to create user"
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
            {isEditMode ? "Edit User" : "Add New User"}
          </DialogTitle>
          <DialogDescription>
            {isEditMode
              ? "Update the user's information below."
              : "Fill in the details to create a new user account."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Username */}
          <div className="space-y-1.5">
            <Label htmlFor="username">
              Username <span className="text-destructive">*</span>
            </Label>
            <Input
              id="username"
              value={form.username}
              onChange={(e) => handleFieldChange("username", e.target.value)}
              placeholder="e.g. john.doe"
              disabled={isEditMode}
              aria-invalid={!!errors.username}
              autoComplete="off"
            />
            {errors.username && (
              <p className="text-sm text-destructive">{errors.username}</p>
            )}
          </div>

          {/* Full Name */}
          <div className="space-y-1.5">
            <Label htmlFor="fullName">
              Full Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="fullName"
              value={form.fullName}
              onChange={(e) => handleFieldChange("fullName", e.target.value)}
              placeholder="e.g. John Doe"
              aria-invalid={!!errors.fullName}
            />
            {errors.fullName && (
              <p className="text-sm text-destructive">{errors.fullName}</p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <Label htmlFor="password">
              Password{" "}
              {!isEditMode && <span className="text-destructive">*</span>}
            </Label>
            <Input
              id="password"
              type="password"
              value={form.password}
              onChange={(e) => handleFieldChange("password", e.target.value)}
              placeholder={
                isEditMode ? "Leave blank to keep current" : "Min. 6 characters"
              }
              aria-invalid={!!errors.password}
              autoComplete="new-password"
            />
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password}</p>
            )}
          </div>

          {/* Role */}
          <div className="space-y-1.5">
            <Label htmlFor="role">Role</Label>
            <Select
              value={form.role}
              onValueChange={(val) =>
                handleFieldChange("role", val as UserRole)
              }
            >
              <SelectTrigger id="role" className="w-full">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Active Status — edit mode only */}
          {isEditMode && (
            <div className="flex items-center gap-3">
              <input
                id="isActive"
                type="checkbox"
                checked={form.isActive}
                onChange={(e) =>
                  handleFieldChange("isActive", e.target.checked)
                }
                className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
              />
              <Label htmlFor="isActive" className="cursor-pointer font-normal">
                Account is active
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
              {saving ? (isEditMode ? "Saving…" : "Creating…") : isEditMode ? "Save Changes" : "Create User"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
