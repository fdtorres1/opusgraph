"use client";

import * as React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  XCircle,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { useRouter } from "next/navigation";

type Step = "upload" | "map" | "validate" | "execute" | "results";

type ValidationResult = {
  rowIndex: number;
  isValid: boolean;
  errors: string[];
  warnings: string[];
  duplicateIds?: string[];
};

type ImportResult = {
  rowIndex: number;
  success: boolean;
  entityId?: string;
  error?: string;
  action: "created" | "failed" | "skipped";
};

type ImportSummary = {
  total: number;
  successful: number;
  failed: number;
  skipped: number;
};

type OrgProp = {
  id: string;
  slug: string;
  name: string;
  type: string;
  plan_tier: string;
};

const libraryFields = [
  { key: "title", label: "Title", required: true },
  { key: "composer_first_name", label: "Composer First Name", required: false },
  { key: "composer_last_name", label: "Composer Last Name", required: false },
  { key: "arranger", label: "Arranger", required: false },
  { key: "publisher", label: "Publisher", required: false },
  { key: "instrumentation", label: "Instrumentation", required: false },
  { key: "copies_owned", label: "Copies Owned", required: false },
  { key: "location", label: "Location", required: false },
  { key: "condition", label: "Condition", required: false },
  { key: "notes", label: "Notes", required: false },
];

export function LibraryCSVImport({ org }: { org: OrgProp }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});
  const [validationResults, setValidationResults] = useState<
    ValidationResult[]
  >([]);
  const [importResults, setImportResults] = useState<ImportResult[]>([]);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [skipDuplicates, setSkipDuplicates] = useState(true);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setLoading(true);

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const res = await fetch("/api/library/import/parse", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const error = await res.json();
        alert(`Error parsing CSV: ${error.error}`);
        return;
      }

      const data = await res.json();
      setHeaders(data.headers);
      setRows(data.rows);
      setStep("map");
    } catch (error) {
      console.error("Error:", error);
      alert("Failed to parse CSV file");
    } finally {
      setLoading(false);
    }
  };

  const handleValidate = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/library/import/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organization_id: org.id,
          fieldMapping,
          rows,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        alert(`Validation error: ${error.error}`);
        return;
      }

      const data = await res.json();
      setValidationResults(data.results);
      setStep("validate");
    } catch (error) {
      console.error("Error:", error);
      alert("Failed to validate CSV");
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/library/import/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organization_id: org.id,
          fieldMapping,
          rows,
          skipDuplicates,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        alert(`Import error: ${error.error}`);
        return;
      }

      const data = await res.json();
      setImportResults(data.results);
      setImportSummary(data.summary);
      setStep("results");
    } catch (error) {
      console.error("Error:", error);
      alert("Failed to execute import");
    } finally {
      setLoading(false);
    }
  };

  const validRows = validationResults.filter((r) => r.isValid).length;
  const invalidRows = validationResults.filter((r) => !r.isValid).length;

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center gap-2 text-sm text-zinc-500">
        {(
          [
            ["upload", "Upload"],
            ["map", "Map"],
            ["validate", "Validate"],
            ["execute", "Execute"],
            ["results", "Results"],
          ] as [Step, string][]
        ).map(([s, label], i) => (
          <React.Fragment key={s}>
            {i > 0 && <span className="text-zinc-300">/</span>}
            <span
              className={
                step === s
                  ? "font-medium text-zinc-900 dark:text-zinc-100"
                  : ""
              }
            >
              {label}
            </span>
          </React.Fragment>
        ))}
      </div>

      {/* Step 1: Upload */}
      {step === "upload" && (
        <Card>
          <CardHeader>
            <CardTitle>Upload CSV File</CardTitle>
            <CardDescription>
              Select a CSV file to import library entries
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>CSV File</Label>
              <Input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                disabled={loading}
              />
            </div>
            {loading && (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Parsing CSV...</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 2: Field Mapping */}
      {step === "map" && (
        <Card>
          <CardHeader>
            <CardTitle>Map CSV Columns</CardTitle>
            <CardDescription>
              Map your CSV columns to library entry fields. Found{" "}
              {rows.length} rows with {headers.length} columns.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              {libraryFields.map((field) => (
                <div key={field.key} className="grid grid-cols-2 gap-4">
                  <Label className="flex items-center gap-2">
                    {field.label}
                    {field.required && (
                      <span className="text-red-500">*</span>
                    )}
                  </Label>
                  <Select
                    value={fieldMapping[field.key] || ""}
                    onValueChange={(value) =>
                      setFieldMapping({ ...fieldMapping, [field.key]: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select column" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {headers.map((header) => (
                        <SelectItem key={header} value={header}>
                          {header}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setStep("upload");
                  setFile(null);
                  setHeaders([]);
                  setRows([]);
                  setFieldMapping({});
                }}
              >
                Back
              </Button>
              <Button onClick={handleValidate} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Validating...
                  </>
                ) : (
                  <>
                    Validate <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Validation Results */}
      {step === "validate" && (
        <Card>
          <CardHeader>
            <CardTitle>Validation Results</CardTitle>
            <CardDescription>
              {validRows} valid rows, {invalidRows} invalid rows
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {validationResults.length > 0 && (
              <div className="border rounded-md max-h-96 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Row</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Errors</TableHead>
                      <TableHead>Warnings</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {validationResults.slice(0, 50).map((result) => (
                      <TableRow key={result.rowIndex}>
                        <TableCell>{result.rowIndex + 1}</TableCell>
                        <TableCell>
                          {result.isValid ? (
                            <Badge variant="default">
                              <CheckCircle2 className="mr-1 h-3 w-3" />
                              Valid
                            </Badge>
                          ) : (
                            <Badge variant="destructive">
                              <XCircle className="mr-1 h-3 w-3" />
                              Invalid
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {result.errors.length > 0 ? (
                            <div className="text-sm text-red-600">
                              {result.errors.join(", ")}
                            </div>
                          ) : (
                            <span className="text-zinc-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {result.warnings.length > 0 ? (
                            <div className="text-sm text-yellow-600">
                              {result.warnings.join(", ")}
                            </div>
                          ) : (
                            <span className="text-zinc-400">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStep("map")}>
                Back
              </Button>
              <Button
                onClick={() => setStep("execute")}
                disabled={validRows === 0}
              >
                Continue <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Execute Import */}
      {step === "execute" && (
        <Card>
          <CardHeader>
            <CardTitle>Execute Import</CardTitle>
            <CardDescription>
              Ready to import {validRows} valid rows
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Skip Duplicates</Label>
                <input
                  type="checkbox"
                  checked={skipDuplicates}
                  onChange={(e) => setSkipDuplicates(e.target.checked)}
                  className="h-4 w-4"
                />
              </div>
              <p className="text-sm text-zinc-500">
                When enabled, rows that match existing library entries will be
                skipped instead of creating duplicates.
              </p>
            </div>

            {loading && (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Importing entries...</span>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setStep("validate")}
                disabled={loading}
              >
                Back
              </Button>
              <Button onClick={handleImport} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    Import {validRows} Rows{" "}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 5: Import Results */}
      {step === "results" && (
        <Card>
          <CardHeader>
            <CardTitle>Import Results</CardTitle>
            <CardDescription>
              {importSummary
                ? `${importSummary.total} total: ${importSummary.successful} created, ${importSummary.failed} failed, ${importSummary.skipped} skipped`
                : `${importResults.filter((r) => r.success).length} successful, ${importResults.filter((r) => !r.success).length} failed`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {importResults.length > 0 && (
              <div className="border rounded-md max-h-96 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Row</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Entry</TableHead>
                      <TableHead>Error</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importResults.slice(0, 50).map((result) => (
                      <TableRow key={result.rowIndex}>
                        <TableCell>{result.rowIndex + 1}</TableCell>
                        <TableCell>
                          {result.success ? (
                            <Badge variant="default">
                              <CheckCircle2 className="mr-1 h-3 w-3" />
                              Success
                            </Badge>
                          ) : (
                            <Badge variant="destructive">
                              <XCircle className="mr-1 h-3 w-3" />
                              Failed
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>{result.action}</TableCell>
                        <TableCell>
                          {result.entityId ? (
                            <a
                              href={`/library/${org.slug}/catalog/${result.entityId}`}
                              className="text-blue-600 hover:underline"
                            >
                              {result.entityId.slice(0, 8)}...
                            </a>
                          ) : (
                            <span className="text-zinc-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {result.error ? (
                            <div className="text-sm text-red-600">
                              {result.error}
                            </div>
                          ) : (
                            <span className="text-zinc-400">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button
                onClick={() => {
                  setStep("upload");
                  setFile(null);
                  setHeaders([]);
                  setRows([]);
                  setFieldMapping({});
                  setValidationResults([]);
                  setImportResults([]);
                  setImportSummary(null);
                }}
              >
                Import Another
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  router.push(`/library/${org.slug}/catalog`)
                }
              >
                View Catalog
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
