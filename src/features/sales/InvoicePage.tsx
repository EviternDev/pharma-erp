import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeftIcon, PrinterIcon } from "lucide-react";
import type { SaleWithDetails } from "@/types";
import { getSaleById } from "@/db/queries/sales";
import { useSettings } from "@/hooks/useSettings";
import { Button } from "@/components/ui/button";
import ReceiptPrintView from "./ReceiptPrintView";

export default function InvoicePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { settings } = useSettings();
  const [sale, setSale] = useState<SaleWithDetails | null>(null);
  const [loading, setLoading] = useState(true);

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

      <ReceiptPrintView sale={sale} settings={settings} />
    </div>
  );
}
