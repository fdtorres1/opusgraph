"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import { format } from "date-fns";
import { AlertTriangle, CheckCircle2, XCircle, GitMerge, Eye } from "lucide-react";

type ReviewFlag = {
  id: string;
  reason: string;
  status: "open" | "resolved" | "dismissed";
  created_at: string;
  entity_type: "composer" | "work";
  entity_id: string;
  details: any;
  entity_name?: string;
  duplicate_ids?: string[];
};

type ComparisonData = {
  primary: any;
  duplicates: any[];
  entity_type: "composer" | "work";
};

export function ReviewQueue({ initialFlags }: { initialFlags: ReviewFlag[] }) {
  const [flags, setFlags] = useState<ReviewFlag[]>(initialFlags);
  const [reasonFilter, setReasonFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("open");
  const [selectedFlag, setSelectedFlag] = useState<ReviewFlag | null>(null);
  const [comparisonData, setComparisonData] = useState<ComparisonData | null>(null);
  const [loading, setLoading] = useState(false);
  const [showComparison, setShowComparison] = useState(false);

  const reasons = Array.from(new Set(flags.map(f => f.reason)));

  const filteredFlags = flags.filter(flag => {
    if (reasonFilter !== "all" && flag.reason !== reasonFilter) return false;
    if (statusFilter !== "all" && flag.status !== statusFilter) return false;
    return true;
  });

  const handleResolve = async (flagId: string, action: "resolve" | "dismiss") => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/review/${flagId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      if (!res.ok) throw new Error("Failed to update flag");

      setFlags(flags.map(f => 
        f.id === flagId 
          ? { ...f, status: action === "resolve" ? "resolved" : "dismissed" }
          : f
      ));
      setSelectedFlag(null);
    } catch (error) {
      console.error("Error:", error);
      alert("Failed to update review flag");
    } finally {
      setLoading(false);
    }
  };

  const handleShowComparison = async (flag: ReviewFlag) => {
    setSelectedFlag(flag);
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/review/${flag.id}/compare`);
      if (!res.ok) throw new Error("Failed to fetch comparison data");
      const data = await res.json();
      setComparisonData(data);
      setShowComparison(true);
    } catch (error) {
      console.error("Error:", error);
      alert("Failed to load comparison data");
    } finally {
      setLoading(false);
    }
  };

  const handleMerge = async (flagId: string, duplicateId: string) => {
    setLoading(true);
    try {
      const flag = flags.find(f => f.id === flagId);
      if (!flag) throw new Error("Flag not found");

      const res = await fetch(`/api/admin/review/${flagId}/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          entity_type: flag.entity_type,
          primary_id: flag.entity_id,
          duplicate_id: duplicateId,
        }),
      });

      if (!res.ok) throw new Error("Failed to merge");

      // Remove the flag and duplicate from the list
      setFlags(flags.filter(f => f.id !== flagId && f.entity_id !== duplicateId));
      setShowComparison(false);
      setSelectedFlag(null);
      setComparisonData(null);
    } catch (error) {
      console.error("Error:", error);
      alert("Failed to merge entities");
    } finally {
      setLoading(false);
    }
  };

  const getReasonBadgeVariant = (reason: string) => {
    if (reason.includes("duplicate")) return "destructive";
    if (reason.includes("incomplete")) return "default";
    return "secondary";
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Review Queue</h1>
        <div className="flex gap-2">
          <Select value={reasonFilter} onValueChange={setReasonFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by reason" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Reasons</SelectItem>
              {reasons.map(reason => (
                <SelectItem key={reason} value={reason}>
                  {reason.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="dismissed">Dismissed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {filteredFlags.length > 0 ? (
        <div className="space-y-4">
          {filteredFlags.map((flag) => (
            <Card key={flag.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-lg">
                      {flag.entity_type === "composer" ? (
                        <Link
                          href={`/admin/composers/${flag.entity_id}`}
                          className="hover:underline"
                        >
                          {flag.entity_name || "Composer Review"}
                        </Link>
                      ) : (
                        <Link
                          href={`/admin/works/${flag.entity_id}`}
                          className="hover:underline"
                        >
                          {flag.entity_name || "Work Review"}
                        </Link>
                      )}
                    </CardTitle>
                    <Badge variant={getReasonBadgeVariant(flag.reason)}>
                      {flag.reason.replace(/_/g, " ")}
                    </Badge>
                    <Badge variant={flag.status === "open" ? "destructive" : "secondary"}>
                      {flag.status}
                    </Badge>
                  </div>
                  <div className="flex gap-2">
                    {flag.reason.includes("duplicate") && flag.status === "open" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleShowComparison(flag)}
                        disabled={loading}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        Compare
                      </Button>
                    )}
                    {flag.status === "open" && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleResolve(flag.id, "resolve")}
                          disabled={loading}
                        >
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          Resolve
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleResolve(flag.id, "dismiss")}
                          disabled={loading}
                        >
                          <XCircle className="w-4 h-4 mr-2" />
                          Dismiss
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <p className="text-zinc-600">
                    <strong>Created:</strong> {format(new Date(flag.created_at), "PPP p")}
                  </p>
                  {flag.details && typeof flag.details === "object" && (
                    <div className="text-zinc-600">
                      <strong>Details:</strong>{" "}
                      <pre className="inline-block text-xs bg-zinc-100 p-1 rounded">
                        {JSON.stringify(flag.details, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-zinc-500">
          <p className="text-lg">No items in the review queue.</p>
          <p className="text-sm mt-2">
            {statusFilter === "open" && reasonFilter === "all"
              ? "All items have been reviewed."
              : "No items match the current filters."}
          </p>
        </div>
      )}

      {/* Comparison Dialog */}
      <Dialog open={showComparison} onOpenChange={setShowComparison}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Compare Duplicates</DialogTitle>
            <DialogDescription>
              Review the differences between the primary entity and potential duplicates
            </DialogDescription>
          </DialogHeader>

          {comparisonData && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold mb-2">Primary Entity</h3>
                  <Card>
                    <CardContent className="p-4 space-y-2">
                      {comparisonData.entity_type === "composer" ? (
                        <>
                          <p><strong>Name:</strong> {comparisonData.primary?.first_name} {comparisonData.primary?.last_name}</p>
                          <p><strong>Birth Year:</strong> {comparisonData.primary?.birth_year || "N/A"}</p>
                          <p><strong>Death Year:</strong> {comparisonData.primary?.death_year || "N/A"}</p>
                          <p><strong>Status:</strong> {comparisonData.primary?.status}</p>
                        </>
                      ) : (
                        <>
                          <p><strong>Work Name:</strong> {comparisonData.primary?.work_name || "N/A"}</p>
                          <p><strong>Composition Year:</strong> {comparisonData.primary?.composition_year || "N/A"}</p>
                          <p><strong>Status:</strong> {comparisonData.primary?.status}</p>
                        </>
                      )}
                      <details className="mt-2">
                        <summary className="cursor-pointer text-sm text-zinc-600">View Full Data</summary>
                        <pre className="text-xs whitespace-pre-wrap mt-2 bg-zinc-50 p-2 rounded">
                          {JSON.stringify(comparisonData.primary, null, 2)}
                        </pre>
                      </details>
                    </CardContent>
                  </Card>
                </div>
                {comparisonData.duplicates.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-2">Potential Duplicate</h3>
                    <Card>
                      <CardContent className="p-4 space-y-2">
                        {comparisonData.entity_type === "composer" ? (
                          <>
                            <p><strong>Name:</strong> {comparisonData.duplicates[0]?.first_name} {comparisonData.duplicates[0]?.last_name}</p>
                            <p><strong>Birth Year:</strong> {comparisonData.duplicates[0]?.birth_year || "N/A"}</p>
                            <p><strong>Death Year:</strong> {comparisonData.duplicates[0]?.death_year || "N/A"}</p>
                            <p><strong>Status:</strong> {comparisonData.duplicates[0]?.status}</p>
                          </>
                        ) : (
                          <>
                            <p><strong>Work Name:</strong> {comparisonData.duplicates[0]?.work_name || "N/A"}</p>
                            <p><strong>Composition Year:</strong> {comparisonData.duplicates[0]?.composition_year || "N/A"}</p>
                            <p><strong>Status:</strong> {comparisonData.duplicates[0]?.status}</p>
                          </>
                        )}
                        <details className="mt-2">
                          <summary className="cursor-pointer text-sm text-zinc-600">View Full Data</summary>
                          <pre className="text-xs whitespace-pre-wrap mt-2 bg-zinc-50 p-2 rounded">
                            {JSON.stringify(comparisonData.duplicates[0], null, 2)}
                          </pre>
                        </details>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>

              <Separator />

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowComparison(false);
                    setComparisonData(null);
                  }}
                >
                  Cancel
                </Button>
                {comparisonData.duplicates.length > 0 && selectedFlag && (
                  <Button
                    onClick={() => handleMerge(selectedFlag.id, comparisonData.duplicates[0].id)}
                    disabled={loading}
                  >
                    <GitMerge className="w-4 h-4 mr-2" />
                    Merge Duplicates
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

