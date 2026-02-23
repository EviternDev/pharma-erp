// Branded type for paise (integer cents of INR)
export type Paise = number & { readonly __brand: 'Paise' };

export type UserRole = 'admin' | 'pharmacist' | 'cashier';

export type PaymentMode = 'cash' | 'card' | 'upi' | 'credit';

export type DosageForm = 'tablet' | 'capsule' | 'syrup' | 'injection' | 'cream' | 'ointment' | 'drops' | 'inhaler' | 'powder' | 'gel' | 'lotion' | 'suspension' | 'other';

export interface User {
  id: number;
  username: string;
  fullName: string;
  passwordHash: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GstSlab {
  id: number;
  /** GST rate as percentage, e.g. 5, 12, 18 */
  rate: number;
  description: string;
}

export interface Medicine {
  id: number;
  name: string;
  genericName: string | null;
  brandName: string | null;
  manufacturer: string | null;
  dosageForm: DosageForm;
  strength: string | null;
  category: string | null;
  /** HSN code — typically 3004 for retail medicines */
  hsnCode: string;
  gstSlabId: number;
  /** Minimum stock level before alert triggers */
  reorderLevel: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Batch {
  id: number;
  medicineId: number;
  batchNumber: string;
  expiryDate: string;
  /** Cost price in paise — what the owner paid */
  costPricePaise: Paise;
  /** Maximum Retail Price in paise — GST-inclusive, illegal to exceed */
  mrpPaise: Paise;
  /** Selling price in paise — must be <= mrpPaise */
  sellingPricePaise: Paise;
  /** Current quantity in stock */
  quantity: number;
  manufacturingDate: string | null;
  createdAt: string;
}

export interface Customer {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Prescription {
  id: number;
  customerId: number;
  saleId: number | null;
  doctorName: string;
  rxNumber: string | null;
  prescriptionDate: string;
  notes: string | null;
  createdAt: string;
}

export interface Supplier {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  gstIn: string | null;
  drugLicenseNo: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierPayment {
  id: number;
  supplierId: number;
  /** Payment amount in paise */
  amountPaise: Paise;
  paymentDate: string;
  paymentMode: PaymentMode;
  reference: string | null;
  notes: string | null;
  createdAt: string;
}

export interface Sale {
  id: number;
  invoiceNumber: string;
  customerId: number | null;
  userId: number;
  saleDate: string;
  /** Subtotal before GST in paise */
  subtotalPaise: Paise;
  /** Total discount in paise */
  discountPaise: Paise;
  /** Total CGST in paise */
  totalCgstPaise: Paise;
  /** Total SGST in paise */
  totalSgstPaise: Paise;
  /** Total GST (CGST + SGST) in paise */
  totalGstPaise: Paise;
  /** Grand total including GST in paise */
  grandTotalPaise: Paise;
  paymentMode: PaymentMode;
  notes: string | null;
  createdAt: string;
}

export interface SaleItem {
  id: number;
  saleId: number;
  batchId: number;
  medicineId: number;
  quantity: number;
  /** Unit selling price in paise */
  unitPricePaise: Paise;
  /** Discount on this item in paise */
  discountPaise: Paise;
  /** Taxable amount (after discount) in paise */
  taxableAmountPaise: Paise;
  /** CGST rate as percentage (half of GST rate) */
  cgstRate: number;
  /** CGST amount in paise */
  cgstAmountPaise: Paise;
  /** SGST rate as percentage (half of GST rate) */
  sgstRate: number;
  /** SGST amount in paise */
  sgstAmountPaise: Paise;
  /** Total for this line item in paise */
  totalPaise: Paise;
}

export interface PharmacySettings {
  id: number;
  name: string;
  address: string;
  phone: string;
  email: string | null;
  /** 15-digit GSTIN */
  gstin: string;
  drugLicenseNo: string;
  /** 2-digit state code for GST */
  stateCode: string;
  invoicePrefix: string;
  nextInvoiceNumber: number;
  /** Default threshold for low stock alerts */
  lowStockThreshold: number;
  /** Days before expiry to trigger alert */
  nearExpiryDays: number;
  createdAt: string;
  updatedAt: string;
}

// View/computed types (not stored directly)
export interface StockAlert {
  medicineId: number;
  medicineName: string;
  currentStock: number;
  reorderLevel: number;
}

export interface ExpiryAlert {
  batchId: number;
  medicineName: string;
  batchNumber: string;
  expiryDate: string;
  daysUntilExpiry: number;
  quantity: number;
}

// Type for Medicine with joined GST info
export interface MedicineWithGst extends Medicine {
  gstRate: number;
}

// Type for Batch with joined Medicine info
export interface BatchWithMedicine extends Batch {
  medicineName: string;
  genericName: string | null;
}

// Type for Sale with joined info
export interface SaleWithDetails extends Sale {
  customerName: string | null;
  userName: string;
  items: SaleItemWithDetails[];
}

export interface SaleItemWithDetails extends SaleItem {
  medicineName: string;
  batchNumber: string;
  hsnCode: string;
  expiryDate: string;
}
