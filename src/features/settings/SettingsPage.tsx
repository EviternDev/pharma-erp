import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import type { PharmacySettings } from '@/types';
import { getSettings, updateSettings } from '@/db/queries/settings';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

type FormData = {
  name?: string;
  address?: string;
  phone?: string;
  email?: string | null;
  gstin?: string;
  drugLicenseNo?: string;
  stateCode?: string;
  invoicePrefix?: string;
  lowStockThreshold?: number;
  nearExpiryDays?: number;
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<PharmacySettings | null>(null);
  const [formData, setFormData] = useState<FormData>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load settings from DB on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setLoading(true);
        const data = await getSettings();
        setSettings(data);
        setFormData(data);
      } catch (err) {
        toast.error('Failed to load pharmacy settings');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, []);

  const validateGSTIN = (gstin: string): boolean => {
    return GSTIN_REGEX.test(gstin);
  };

  const handleChange = (field: keyof FormData, value: string | number | null) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    // Clear error for this field when user starts editing
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }

    // Real-time GSTIN validation
    if (field === 'gstin' && value) {
      if (!validateGSTIN(String(value))) {
        setErrors((prev) => ({
          ...prev,
          gstin: 'GSTIN must be 15 characters in format: 2 digits, 5 letters, 4 digits, 1 letter, 1 letter/digit, Z, 1 alphanumeric',
        }));
      }
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Required fields validation
    if (!formData.name?.trim()) {
      newErrors.name = 'Pharmacy name is required';
    }

    if (!formData.address?.trim()) {
      newErrors.address = 'Address is required';
    }

    if (!formData.phone?.trim()) {
      newErrors.phone = 'Phone number is required';
    }

    if (!formData.gstin?.trim()) {
      newErrors.gstin = 'GSTIN is required';
    } else if (!validateGSTIN(formData.gstin)) {
      newErrors.gstin = 'GSTIN format is invalid';
    }

    if (!formData.drugLicenseNo?.trim()) {
      newErrors.drugLicenseNo = 'Drug license number is required';
    }

    if (!formData.stateCode?.trim()) {
      newErrors.stateCode = 'State code is required';
    } else if (String(formData.stateCode).length !== 2) {
      newErrors.stateCode = 'State code must be 2 digits';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error('Please fix the errors below');
      return;
    }

    try {
      setSaving(true);

      // Only send changed fields
      const fieldsToCheck: (keyof FormData)[] = [
        'name',
        'address',
        'phone',
        'email',
        'gstin',
        'drugLicenseNo',
        'stateCode',
        'invoicePrefix',
        'lowStockThreshold',
        'nearExpiryDays',
      ];

      const changedFields: Record<string, unknown> = {};
      let hasChanges = false;

      fieldsToCheck.forEach((field) => {
        if (formData[field] !== settings?.[field]) {
          changedFields[field] = formData[field];
          hasChanges = true;
        }
      });

      if (!hasChanges) {
        toast.info('No changes to save');
        return;
      }

      await updateSettings(changedFields as Parameters<typeof updateSettings>[0]);
      toast.success('Settings saved successfully');

      // Reload settings to confirm
      const updatedSettings = await getSettings();
      setSettings(updatedSettings);
      setFormData(updatedSettings);
    } catch (err) {
      toast.error('Failed to save settings');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-slate-600">Loading pharmacy settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Pharmacy Settings</h1>
        <p className="text-slate-600 mt-2">Configure your pharmacy details, GST information, and system preferences.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Pharmacy Name and Phone */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="name">Pharmacy Name *</Label>
                <Input
                  id="name"
                  value={formData.name || ''}
                  onChange={(e) => handleChange('name', e.target.value)}
                  placeholder="Enter pharmacy name"
                  aria-invalid={!!errors.name}
                />
                {errors.name && <p className="text-sm text-red-600">{errors.name}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone *</Label>
                <Input
                  id="phone"
                  value={formData.phone || ''}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  placeholder="Enter phone number"
                  aria-invalid={!!errors.phone}
                />
                {errors.phone && <p className="text-sm text-red-600">{errors.phone}</p>}
              </div>
            </div>

            {/* Address */}
            <div className="space-y-2">
              <Label htmlFor="address">Address *</Label>
              <textarea
                id="address"
                value={formData.address || ''}
                onChange={(e) => handleChange('address', e.target.value)}
                placeholder="Enter full address"
                rows={3}
                aria-invalid={!!errors.address}
                className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {errors.address && <p className="text-sm text-red-600">{errors.address}</p>}
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email || ''}
                onChange={(e) => handleChange('email', e.target.value)}
                placeholder="Enter email address"
              />
            </div>

            {/* GST and License */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="gstin">GSTIN (15 chars) *</Label>
                <Input
                  id="gstin"
                  value={formData.gstin || ''}
                  onChange={(e) => handleChange('gstin', e.target.value.toUpperCase())}
                  placeholder="E.g., 27AAFCT5055K1Z0"
                  maxLength={15}
                  aria-invalid={!!errors.gstin}
                />
                {errors.gstin && <p className="text-sm text-red-600">{errors.gstin}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="drugLicenseNo">Drug License No *</Label>
                <Input
                  id="drugLicenseNo"
                  value={formData.drugLicenseNo || ''}
                  onChange={(e) => handleChange('drugLicenseNo', e.target.value)}
                  placeholder="Enter license number"
                  aria-invalid={!!errors.drugLicenseNo}
                />
                {errors.drugLicenseNo && <p className="text-sm text-red-600">{errors.drugLicenseNo}</p>}
              </div>
            </div>

            {/* State Code and Invoice Prefix */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="stateCode">State Code (2 digits) *</Label>
                <Input
                  id="stateCode"
                  value={formData.stateCode || ''}
                  onChange={(e) => handleChange('stateCode', e.target.value)}
                  placeholder="E.g., 27"
                  maxLength={2}
                  aria-invalid={!!errors.stateCode}
                />
                {errors.stateCode && <p className="text-sm text-red-600">{errors.stateCode}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="invoicePrefix">Invoice Prefix *</Label>
                <Input
                  id="invoicePrefix"
                  value={formData.invoicePrefix || ''}
                  onChange={(e) => handleChange('invoicePrefix', e.target.value.toUpperCase())}
                  placeholder="E.g., INV"
                  aria-invalid={!!errors.invoicePrefix}
                />
                {errors.invoicePrefix && <p className="text-sm text-red-600">{errors.invoicePrefix}</p>}
              </div>
            </div>

            {/* Stock and Expiry Thresholds */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="lowStockThreshold">Low Stock Threshold *</Label>
                <Input
                  id="lowStockThreshold"
                  type="number"
                  value={formData.lowStockThreshold || 20}
                  onChange={(e) => handleChange('lowStockThreshold', parseInt(e.target.value, 10))}
                  min="1"
                  aria-invalid={!!errors.lowStockThreshold}
                />
                {errors.lowStockThreshold && <p className="text-sm text-red-600">{errors.lowStockThreshold}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="nearExpiryDays">Near Expiry Days *</Label>
                <Input
                  id="nearExpiryDays"
                  type="number"
                  value={formData.nearExpiryDays || 90}
                  onChange={(e) => handleChange('nearExpiryDays', parseInt(e.target.value, 10))}
                  min="1"
                  aria-invalid={!!errors.nearExpiryDays}
                />
                {errors.nearExpiryDays && <p className="text-sm text-red-600">{errors.nearExpiryDays}</p>}
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-4">
              <Button type="submit" disabled={saving} className="w-full md:w-auto">
                {saving ? 'Saving...' : 'Save Settings'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
