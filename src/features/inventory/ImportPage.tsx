import { useState, useCallback } from "react";
import { toast } from "sonner";
import Papa from "papaparse";
import { open } from "@tauri-apps/plugin-dialog";
import { readTextFile } from "@tauri-apps/plugin-fs";
import {
  UploadIcon,
  DownloadIcon,
  CheckCircle2Icon,
  XCircleIcon,
  FileSpreadsheetIcon,
} from "lucide-react";
import { createMedicine } from "@/db/queries/medicines";
import { getGstSlabs } from "@/db/queries/gstSlabs";
import type { GstSlab } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const TEMPLATE_HEADERS = [
  "Name",
  "Generic Name",
  "Brand Name",
  "Manufacturer",
  "Dosage Form",
  "Strength",
  "Category",
  "HSN Code",
  "GST Rate (%)",
  "Reorder Level",
];

const VALID_DOSAGE_FORMS = [
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

interface ParsedRow {
  rowIndex: number;
  name: string;
  genericName: string;
  brandName: string;
  manufacturer: string;
  dosageForm: string;
  strength: string;
  category: string;
  hsnCode: string;
  gstRate: string;
  reorderLevel: string;
  errors: string[];
  isValid: boolean;
}

export default function ImportPage() {
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    imported: number;
    skipped: number;
  } | null>(null);
  const [gstSlabs, setGstSlabs] = useState<GstSlab[]>([]);

  function downloadTemplate() {
    const csv = TEMPLATE_HEADERS.join(",") + "\n";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "medicine_import_template.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  function validateRow(
    row: Record<string, string>,
    rowIndex: number,
    validGstRates: number[]
  ): ParsedRow {
    const errors: string[] = [];

    const name = (row["Name"] ?? "").trim();
    const genericName = (row["Generic Name"] ?? "").trim();
    const brandName = (row["Brand Name"] ?? "").trim();
    const manufacturer = (row["Manufacturer"] ?? "").trim();
    const dosageForm = (row["Dosage Form"] ?? "tablet").trim().toLowerCase();
    const strength = (row["Strength"] ?? "").trim();
    const category = (row["Category"] ?? "").trim().toLowerCase();
    const hsnCode = (row["HSN Code"] ?? "3004").trim();
    const gstRate = (row["GST Rate (%)"] ?? "").trim();
    const reorderLevel = (row["Reorder Level"] ?? "20").trim();

    if (!name) {
      errors.push("Name is required");
    }

    if (dosageForm && !VALID_DOSAGE_FORMS.includes(dosageForm)) {
      errors.push(`Invalid dosage form: ${dosageForm}`);
    }

    if (hsnCode && !/^\d{4,8}$/.test(hsnCode)) {
      errors.push("HSN code must be 4-8 digits");
    }

    if (!gstRate) {
      errors.push("GST Rate is required");
    } else {
      const rate = parseFloat(gstRate);
      if (isNaN(rate) || !validGstRates.includes(rate)) {
        errors.push(
          `Invalid GST rate: ${gstRate}. Valid rates: ${validGstRates.join(", ")}`
        );
      }
    }

    const reorderNum = parseInt(reorderLevel, 10);
    if (reorderLevel && (isNaN(reorderNum) || reorderNum < 0)) {
      errors.push("Reorder level must be a non-negative number");
    }

    return {
      rowIndex,
      name,
      genericName,
      brandName,
      manufacturer,
      dosageForm,
      strength,
      category,
      hsnCode: hsnCode || "3004",
      gstRate,
      reorderLevel: reorderLevel || "20",
      errors,
      isValid: errors.length === 0,
    };
  }

  const handleFileUpload = useCallback(async () => {
      setImportResult(null);
    try {
      const selectedPath = await open({
        title: "Choose CSV File",
        filters: [{ name: "CSV Files", extensions: ["csv"] }],
        multiple: false,
      });

      if (!selectedPath) return; // user cancelled
        // Load GST slabs for validation
      const slabs = await getGstSlabs();
      setGstSlabs(slabs);
        const validRates = slabs.map((s) => s.rate);
      const text = await readTextFile(selectedPath);
      const result = Papa.parse<Record<string, string>>(text, {
        header: true,
        skipEmptyLines: true,
      });
        if (result.errors.length > 0) {
        toast.error(
          `CSV parse errors: ${result.errors.map((err) => err.message).join(", ")}`
        );
      }
        const validated = result.data.map((row, idx) =>
        validateRow(row, idx + 2, validRates)
      );

      setParsedRows(validated);
        const validCount = validated.filter((r) => r.isValid).length;
      const invalidCount = validated.length - validCount;
      toast.info(
        `Parsed ${validated.length} rows: ${validCount} valid, ${invalidCount} with errors`
      );
    } catch (err) {
      console.error(err);
      toast.error("Failed to parse CSV file");
    }
  }, []);

  async function handleImport() {
    const validRows = parsedRows.filter((r) => r.isValid);
    if (validRows.length === 0) {
      toast.error("No valid rows to import");
      return;
    }

    setImporting(true);
    let imported = 0;
    let skipped = 0;

    // Need GST slab mapping (rate -> id)
    let slabs = gstSlabs;
    if (slabs.length === 0) {
      slabs = await getGstSlabs();
      setGstSlabs(slabs);
    }
    const rateToSlabId = new Map(slabs.map((s) => [s.rate, s.id]));

    for (const row of validRows) {
      try {
        const gstRate = parseFloat(row.gstRate);
        const slabId = rateToSlabId.get(gstRate);
        if (!slabId) {
          skipped++;
          continue;
        }

        await createMedicine({
          name: row.name,
          genericName: row.genericName || null,
          brandName: row.brandName || null,
          manufacturer: row.manufacturer || null,
          dosageForm: row.dosageForm || "tablet",
          strength: row.strength || null,
          category: row.category || null,
          hsnCode: row.hsnCode,
          gstSlabId: slabId,
          reorderLevel: parseInt(row.reorderLevel, 10) || 20,
        });
        imported++;
      } catch (err) {
        console.error(`Failed to import row ${row.rowIndex}:`, err);
        skipped++;
      }
    }

    setImporting(false);
    setImportResult({ imported, skipped });
    toast.success(`Import complete: ${imported} imported, ${skipped} skipped`);
  }

  const validCount = parsedRows.filter((r) => r.isValid).length;
  const invalidCount = parsedRows.length - validCount;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Import Data</h1>
          <p className="text-slate-600 mt-1">
            Bulk import medicines from a CSV file
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button variant="outline" onClick={downloadTemplate} className="gap-2">
          <DownloadIcon className="size-4" />
          Download Template
        </Button>

        <Button
          variant="default"
          className="gap-2"
          onClick={handleFileUpload}
        >
          <UploadIcon className="size-4" />
          Choose CSV File
        </Button>
      </div>

      {/* Import result summary */}
      {importResult && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-emerald-800 font-medium">
            Import complete: {importResult.imported} imported,{" "}
            {importResult.skipped} skipped
          </p>
        </div>
      )}

      {/* Preview table */}
      {parsedRows.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <p className="text-sm text-slate-600">
                {parsedRows.length} rows parsed
              </p>
              {validCount > 0 && (
                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">
                  {validCount} valid
                </Badge>
              )}
              {invalidCount > 0 && (
                <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100">
                  {invalidCount} errors
                </Badge>
              )}
            </div>

            <Button
              onClick={handleImport}
              disabled={importing || validCount === 0}
              className="gap-2"
            >
              {importing ? "Importing..." : `Import ${validCount} Valid Rows`}
            </Button>
          </div>

          <div className="rounded-lg border bg-card shadow-sm overflow-auto max-h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">#</TableHead>
                  <TableHead className="w-[40px]">Status</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Generic Name</TableHead>
                  <TableHead>Brand</TableHead>
                  <TableHead>Manufacturer</TableHead>
                  <TableHead>Form</TableHead>
                  <TableHead>Strength</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>HSN</TableHead>
                  <TableHead>GST %</TableHead>
                  <TableHead>Reorder</TableHead>
                  <TableHead>Errors</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parsedRows.map((row) => (
                  <TableRow
                    key={row.rowIndex}
                    className={row.isValid ? "" : "bg-red-50"}
                  >
                    <TableCell className="text-xs text-muted-foreground">
                      {row.rowIndex}
                    </TableCell>

                    <TableCell>
                      {row.isValid ? (
                        <CheckCircle2Icon className="size-4 text-emerald-600" />
                      ) : (
                        <XCircleIcon className="size-4 text-red-500" />
                      )}
                    </TableCell>

                    <TableCell className="font-medium text-sm">
                      {row.name || "\u2014"}
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">
                      {row.genericName || "\u2014"}
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">
                      {row.brandName || "\u2014"}
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">
                      {row.manufacturer || "\u2014"}
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">
                      {row.dosageForm || "\u2014"}
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">
                      {row.strength || "\u2014"}
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">
                      {row.category || "\u2014"}
                    </TableCell>
                    <TableCell className="text-sm font-mono text-slate-600">
                      {row.hsnCode}
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">
                      {row.gstRate}%
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">
                      {row.reorderLevel}
                    </TableCell>
                    <TableCell className="text-sm text-red-600 max-w-[200px]">
                      {row.errors.length > 0
                        ? row.errors.join("; ")
                        : "\u2014"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {/* Empty state */}
      {parsedRows.length === 0 && !importResult && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <FileSpreadsheetIcon className="size-10 text-muted-foreground/40" />
          <p className="text-muted-foreground text-sm">
            Download the template, fill in your medicine data, then upload the
            CSV file.
          </p>
        </div>
      )}
    </div>
  );
}
