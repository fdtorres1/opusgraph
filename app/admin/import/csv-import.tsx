"use client";

import * as React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
// Alert component not needed for now
import { CheckCircle2, XCircle, Upload, ArrowRight, Loader2 } from "lucide-react";
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
  action: "created" | "updated" | "skipped";
};

export function CSVImport() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("upload");
  const [entityType, setEntityType] = useState<"composer" | "work">("composer");
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);
  const [importResults, setImportResults] = useState<ImportResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [skipDuplicates, setSkipDuplicates] = useState(true);

  const composerFields = [
    { key: "first_name", label: "First Name", required: true },
    { key: "last_name", label: "Last Name", required: true },
    { key: "birth_year", label: "Birth Year", required: false },
    { key: "death_year", label: "Death Year", required: false },
    { key: "nationalities", label: "Nationalities (comma-separated ISO2 codes)", required: false },
    { key: "links", label: "Links (comma-separated URLs)", required: false },
    { key: "status", label: "Status (draft/published)", required: false },
  ];

  const workFields = [
    { key: "work_name", label: "Work Name", required: true },
    { key: "composer_id", label: "Composer ID (UUID)", required: true },
    { key: "composition_year", label: "Composition Year", required: false },
    { key: "duration", label: "Duration (MM:SS or HH:MM:SS)", required: false },
    { key: "instrumentation_text", label: "Instrumentation", required: false },
    { key: "sources", label: "Sources (comma-separated URLs)", required: false },
    { key: "recordings", label: "Recordings (comma-separated URLs)", required: false },
    { key: "status", label: "Status (draft/published)", required: false },
  ];

  const fields = entityType === "composer" ? composerFields : workFields;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setLoading(true);

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const res = await fetch("/api/admin/import/parse", {
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
      const res = await fetch("/api/admin/import/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType,
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
      setStep("execute");
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
      const res = await fetch("/api/admin/import/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType,
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
  const successfulImports = importResults.filter((r) => r.success).length;
  const failedImports = importResults.filter((r) => !r.success).length;

  return (
    <div className="space-y-6">
      {/* Step 1: Upload */}
      {step === "upload" && (
        <Card>
          <CardHeader>
            <CardTitle>Upload CSV File</CardTitle>
            <CardDescription>Select a CSV file to import composers or works</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Entity Type</Label>
              <Select value={entityType} onValueChange={(v: "composer" | "work") => setEntityType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="composer">Composers</SelectItem>
                  <SelectItem value="work">Works</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
            <CardDescription>Map your CSV columns to database fields</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              {fields.map((field) => (
                <div key={field.key} className="grid grid-cols-2 gap-4">
                  <Label className="flex items-center gap-2">
                    {field.label}
                    {field.required && <span className="text-red-500">*</span>}
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
              <Button variant="outline" onClick={() => setStep("upload")}>
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
      {step === "execute" && (
        <Card>
          <CardHeader>
            <CardTitle>Validation Results</CardTitle>
            <CardDescription>
              {validRows} valid rows, {invalidRows} invalid rows
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
            </div>

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
              <Button onClick={handleImport} disabled={loading || validRows === 0}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    Import {validRows} Rows <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Import Results */}
      {step === "results" && (
        <Card>
          <CardHeader>
            <CardTitle>Import Results</CardTitle>
            <CardDescription>
              {successfulImports} successful, {failedImports} failed
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
                      <TableHead>Entity ID</TableHead>
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
                              href={`/admin/${entityType}s/${result.entityId}`}
                              className="text-blue-600 hover:underline"
                              target="_blank"
                            >
                              {result.entityId.slice(0, 8)}...
                            </a>
                          ) : (
                            <span className="text-zinc-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {result.error ? (
                            <div className="text-sm text-red-600">{result.error}</div>
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
                }}
              >
                Import Another File
              </Button>
              <Button variant="outline" onClick={() => router.push(`/admin/${entityType}s`)}>
                View {entityType === "composer" ? "Composers" : "Works"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

