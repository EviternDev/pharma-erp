import type { DosageForm, PaymentMode, UserRole } from './index';

// Form types use strings for user input — converted to proper types on save
export interface MedicineFormData {
  name: string;
  genericName: string;
  brandName: string;
  manufacturer: string;
  dosageForm: DosageForm;
  strength: string;
  category: string;
  hsnCode: string;
  gstSlabId: number | '';
  reorderLevel: string; // string input, parsed to number
}

export interface BatchFormData {
  medicineId: number | '';
  batchNumber: string;
  expiryDate: string; // YYYY-MM-DD
  /** User enters in rupees (e.g. "100.50"), converted to paise on save */
  costPrice: string;
  /** User enters in rupees, converted to paise on save */
  mrp: string;
  /** User enters in rupees, converted to paise on save */
  sellingPrice: string;
  quantity: string;
  manufacturingDate: string;
}

export interface CustomerFormData {
  name: string;
  phone: string;
  email: string;
  address: string;
}

export interface SupplierFormData {
  name: string;
  phone: string;
  email: string;
  address: string;
  gstIn: string;
  drugLicenseNo: string;
}

export interface UserFormData {
  username: string;
  fullName: string;
  password: string;
  role: UserRole;
}

export interface PrescriptionFormData {
  customerId: number | '';
  doctorName: string;
  rxNumber: string;
  prescriptionDate: string;
  notes: string;
}

export interface SupplierPaymentFormData {
  supplierId: number | '';
  /** User enters in rupees */
  amount: string;
  paymentDate: string;
  paymentMode: PaymentMode;
  reference: string;
  notes: string;
}

export interface PharmacySettingsFormData {
  name: string;
  address: string;
  phone: string;
  email: string;
  gstin: string;
  drugLicenseNo: string;
  stateCode: string;
  invoicePrefix: string;
  lowStockThreshold: string;
  nearExpiryDays: string;
}

export interface LoginFormData {
  username: string;
  password: string;
}
