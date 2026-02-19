import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeftIcon, PrinterIcon } from "lucide-react";
import type { SaleWithDetails } from "@/types";
import { getSaleById } from "@/db/queries/sales";
import { useSettings } from "@/hooks/useSettings";
import { formatPaiseToCurrency } from "@/lib/currency";
import { paiseToWords } from "@/lib/numberToWords";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

interface HsnSummary {
  hsnCode: string;
  taxableValue: number;
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  totalGst: number;
}

export default function InvoicePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { settings } = useSettings();
  const [sale, setSale] = useState<SaleWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [hsnSummary, setHsnSummary] = useState<HsnSummary[]>([]);

  const loadSale = useCallback(async () => {
    const saleId = Number(id);
    if (!saleId || isNaN(saleId)) {
      toast.error("Invalid sale ID");
      navigate("/sales/history");
      return;
    }

    try {
      setLoading(true);
      const data = await getSaleById(saleId);
      if (!data) {
        toast.error("Sale not found");
        navigate("/sales/history");
        return;
      }
      setSale(data);

      // Build HSN summary grouped by GST rate
      const hsnMap = new Map<string, HsnSummary>();
      for (const item of data.items) {
        const gstRate = item.cgstRate + item.sgstRate;
        const key = `${gstRate}`;
        const existing = hsnMap.get(key);
        if (existing) {
          existing.taxableValue += item.taxableAmountPaise;
          existing.cgstAmount += item.cgstAmountPaise;
          existing.sgstAmount += item.sgstAmountPaise;
          existing.totalGst += item.cgstAmountPaise + item.sgstAmountPaise;
        } else {
          hsnMap.set(key, {
            hsnCode: "3004",
            taxableValue: item.taxableAmountPaise,
            cgstRate: item.cgstRate,
            cgstAmount: item.cgstAmountPaise,
            sgstRate: item.sgstRate,
            sgstAmount: item.sgstAmountPaise,
            totalGst: item.cgstAmountPaise + item.sgstAmountPaise,
          });
        }
      }
      setHsnSummary(Array.from(hsnMap.values()));
    } catch (err) {
      console.error(err);
      toast.error("Failed to load invoice");
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    loadSale();
  }, [loadSale]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-muted-foreground text-sm">Loading invoice\u2026</p>
      </div>
    );
  }

  if (!sale || !settings) return null;

  return (
    <div className="space-y-4">
      {/* Actions bar (hidden on print) */}
      <div className="flex items-center justify-between no-print">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/sales/history")}
          className="gap-1 text-muted-foreground"
        >
          <ArrowLeftIcon className="size-4" />
          Sales History
        </Button>
        <Button
          onClick={() => window.print()}
          className="gap-2 print-visible"
        >
          <PrinterIcon className="size-4" />
          Print Invoice
        </Button>
      </div>

      {/* Invoice content */}
      <div className="max-w-4xl mx-auto bg-white border rounded-lg shadow-sm p-8 print:shadow-none print:border-0 print:p-0 print:max-w-none" id="invoice-content">
        {/* Header */}
        <div className="text-center border-b pb-4 mb-4">
          <h2 className="text-xl font-bold text-slate-900">{settings.name || "PharmaCare Pharmacy"}</h2>
          <p className="text-sm text-slate-600">{settings.address}</p>
          <p className="text-sm text-slate-600">
            Phone: {settings.phone}
            {settings.email ? ` | Email: ${settings.email}` : ""}
          </p>
          <div className="flex justify-center gap-6 mt-2 text-xs text-slate-500">
            <span>GSTIN: <span className="font-mono font-medium">{settings.gstin || "\u2014"}</span></span>
            <span>DL No: <span className="font-medium">{settings.drugLicenseNo || "\u2014"}</span></span>
          </div>
        </div>

        {/* Invoice details */}
        <div className="flex justify-between mb-4">
          <div>
            <p className="text-xs text-slate-500">Invoice Number</p>
            <p className="font-mono font-bold text-lg">{sale.invoiceNumber}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500">Date</p>
            <p className="font-medium">{formatDate(sale.saleDate)}</p>
            {settings.stateCode && (
              <p className="text-xs text-slate-500 mt-1">
                Place of Supply: State Code {settings.stateCode}
              </p>
            )}
          </div>
        </div>

        {/* Customer info */}
        {sale.customerName && (
          <div className="mb-4 p-3 bg-slate-50 rounded-md print:bg-transparent print:p-0 print:border-b print:pb-2">
            <p className="text-xs text-slate-500">Bill To</p>
            <p className="font-medium text-sm">{sale.customerName}</p>
          </div>
        )}

        {/* Items table */}
        <table className="w-full text-sm border-collapse mb-4">
          <thead>
            <tr className="border-b-2 border-slate-300">
              <th className="text-left py-2 px-1 text-xs font-semibold text-slate-600">#</th>
              <th className="text-left py-2 px-1 text-xs font-semibold text-slate-600">Medicine</th>
              <th className="text-left py-2 px-1 text-xs font-semibold text-slate-600">Batch</th>
              <th className="text-center py-2 px-1 text-xs font-semibold text-slate-600">Qty</th>
              <th className="text-right py-2 px-1 text-xs font-semibold text-slate-600">Price</th>
              <th className="text-right py-2 px-1 text-xs font-semibold text-slate-600">Disc.</th>
              <th className="text-right py-2 px-1 text-xs font-semibold text-slate-600">Taxable</th>
              <th className="text-center py-2 px-1 text-xs font-semibold text-slate-600">CGST</th>
              <th className="text-center py-2 px-1 text-xs font-semibold text-slate-600">SGST</th>
              <th className="text-right py-2 px-1 text-xs font-semibold text-slate-600">Total</th>
            </tr>
          </thead>
          <tbody>
            {sale.items.map((item, idx) => (
              <tr key={item.id} className="border-b border-slate-100">
                <td className="py-1.5 px-1 text-slate-500">{idx + 1}</td>
                <td className="py-1.5 px-1 font-medium">{item.medicineName}</td>
                <td className="py-1.5 px-1 font-mono text-xs text-slate-600">{item.batchNumber}</td>
                <td className="py-1.5 px-1 text-center tabular-nums">{item.quantity}</td>
                <td className="py-1.5 px-1 text-right tabular-nums">{formatPaiseToCurrency(item.unitPricePaise)}</td>
                <td className="py-1.5 px-1 text-right tabular-nums">{item.discountPaise > 0 ? formatPaiseToCurrency(item.discountPaise) : "\u2014"}</td>
                <td className="py-1.5 px-1 text-right tabular-nums">{formatPaiseToCurrency(item.taxableAmountPaise)}</td>
                <td className="py-1.5 px-1 text-center tabular-nums text-xs">
                  <div>{item.cgstRate}%</div>
                  <div className="text-slate-500">{formatPaiseToCurrency(item.cgstAmountPaise)}</div>
                </td>
                <td className="py-1.5 px-1 text-center tabular-nums text-xs">
                  <div>{item.sgstRate}%</div>
                  <div className="text-slate-500">{formatPaiseToCurrency(item.sgstAmountPaise)}</div>
                </td>
                <td className="py-1.5 px-1 text-right tabular-nums font-medium">{formatPaiseToCurrency(item.totalPaise)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* HSN Summary */}
        {hsnSummary.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              HSN-wise Tax Summary
            </p>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left py-1.5 px-2">HSN</th>
                  <th className="text-right py-1.5 px-2">Taxable Value</th>
                  <th className="text-right py-1.5 px-2">CGST</th>
                  <th className="text-right py-1.5 px-2">SGST</th>
                  <th className="text-right py-1.5 px-2">Total GST</th>
                </tr>
              </thead>
              <tbody>
                {hsnSummary.map((hsn, idx) => (
                  <tr key={idx} className="border-b border-slate-100">
                    <td className="py-1 px-2 font-mono">{hsn.hsnCode}</td>
                    <td className="py-1 px-2 text-right tabular-nums">{formatPaiseToCurrency(hsn.taxableValue)}</td>
                    <td className="py-1 px-2 text-right tabular-nums">{formatPaiseToCurrency(hsn.cgstAmount)} ({hsn.cgstRate}%)</td>
                    <td className="py-1 px-2 text-right tabular-nums">{formatPaiseToCurrency(hsn.sgstAmount)} ({hsn.sgstRate}%)</td>
                    <td className="py-1 px-2 text-right tabular-nums font-medium">{formatPaiseToCurrency(hsn.totalGst)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Totals */}
        <div className="flex justify-end mb-4">
          <div className="w-72 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600">Subtotal</span>
              <span className="tabular-nums">{formatPaiseToCurrency(sale.subtotalPaise)}</span>
            </div>
            {sale.discountPaise > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Discount</span>
                <span className="tabular-nums">-{formatPaiseToCurrency(sale.discountPaise)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-600">CGST</span>
              <span className="tabular-nums">{formatPaiseToCurrency(sale.totalCgstPaise)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">SGST</span>
              <span className="tabular-nums">{formatPaiseToCurrency(sale.totalSgstPaise)}</span>
            </div>
            <Separator />
            <div className="flex justify-between font-bold text-lg pt-1">
              <span>Grand Total</span>
              <span className="tabular-nums">{formatPaiseToCurrency(sale.grandTotalPaise)}</span>
            </div>
          </div>
        </div>

        {/* Amount in words */}
        <div className="border-t border-b py-2 mb-4">
          <p className="text-xs text-slate-500">Amount in Words</p>
          <p className="text-sm font-medium italic">{paiseToWords(sale.grandTotalPaise)}</p>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-end text-xs text-slate-500 mt-6">
          <div>
            <p>E. & O.E.</p>
            <p>This is a computer-generated invoice</p>
          </div>
          <div className="text-right">
            <p className="mb-8">Authorized Signatory</p>
            <p>Thank you for your visit!</p>
          </div>
        </div>
      </div>
    </div>
  );
}
