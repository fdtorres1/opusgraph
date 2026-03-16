"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Copy, Check } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type OrgInfo = {
  id: string;
  slug: string;
  name: string;
  type: string;
  plan_tier: string;
};

type OrgDetails = OrgInfo & {
  created_at: string;
};

const ORG_TYPES = [
  { value: "orchestra", label: "Orchestra" },
  { value: "choir", label: "Choir" },
  { value: "band", label: "Band" },
  { value: "church", label: "Church" },
  { value: "school", label: "School" },
  { value: "other", label: "Other" },
] as const;

const PLAN_LABELS: Record<string, string> = {
  free: "Free",
  starter: "Starter",
  professional: "Professional",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SettingsClient({ org }: { org: OrgInfo }) {
  const router = useRouter();

  // Full org details (with created_at)
  const [orgDetails, setOrgDetails] = useState<OrgDetails | null>(null);
  const [loading, setLoading] = useState(true);

  // Form state
  const [name, setName] = useState(org.name);
  const [type, setType] = useState(org.type);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Delete state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Copy ID state
  const [copied, setCopied] = useState(false);

  // ---------------------------------------------------------------------------
  // Fetch full org details
  // ---------------------------------------------------------------------------

  const fetchDetails = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/library/settings?organization_id=${org.id}`
      );
      if (res.ok) {
        const data = await res.json();
        setOrgDetails(data.org);
        setName(data.org.name);
        setType(data.org.type);
      }
    } finally {
      setLoading(false);
    }
  }, [org.id]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  // ---------------------------------------------------------------------------
  // Save settings
  // ---------------------------------------------------------------------------

  async function handleSave() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setSaveError("Organization name is required.");
      return;
    }

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const res = await fetch("/api/library/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organization_id: org.id,
          name: trimmedName,
          type,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setSaveError(data?.error ?? "Failed to save settings.");
        return;
      }

      const data = await res.json();
      setSaveSuccess(true);

      // If slug changed, redirect to new URL
      if (data.org?.slug && data.org.slug !== org.slug) {
        router.push(`/library/${data.org.slug}/settings`);
        router.refresh();
      } else {
        router.refresh();
        // Re-fetch to update display
        await fetchDetails();
      }

      // Clear success message after 3 seconds
      setTimeout(() => setSaveSuccess(false), 3000);
    } finally {
      setSaving(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Delete organization
  // ---------------------------------------------------------------------------

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch("/api/library/settings", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organization_id: org.id }),
      });

      if (res.ok) {
        router.push("/");
        router.refresh();
      }
    } finally {
      setDeleting(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Copy Org ID
  // ---------------------------------------------------------------------------

  function handleCopyId() {
    navigator.clipboard.writeText(org.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your organization settings.
        </p>
      </div>

      <div className="space-y-6 max-w-2xl">
        {/* Organization Details Card */}
        <Card>
          <CardHeader>
            <CardTitle>Organization Details</CardTitle>
            <CardDescription>
              Update your organization name and type.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Organization Name */}
            <div className="space-y-2">
              <Label htmlFor="org-name">Organization Name</Label>
              <Input
                id="org-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter organization name"
              />
            </div>

            {/* Organization Type */}
            <div className="space-y-2">
              <Label htmlFor="org-type">Organization Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a type" />
                </SelectTrigger>
                <SelectContent>
                  {ORG_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Save button + messages */}
            <div className="flex items-center gap-3 pt-2">
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Changes
              </Button>
              {saveError && (
                <p className="text-sm text-destructive">{saveError}</p>
              )}
              {saveSuccess && (
                <p className="text-sm text-green-600">Settings saved.</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Plan Tier Card */}
        <Card>
          <CardHeader>
            <CardTitle>Plan</CardTitle>
            <CardDescription>
              Your current subscription plan.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="text-sm">
                {PLAN_LABELS[org.plan_tier] || org.plan_tier}
              </Badge>
              <p className="text-sm text-muted-foreground">
                Contact support to change plans.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Organization Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>Organization Info</CardTitle>
            <CardDescription>
              Reference information for your organization.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Org ID */}
            <div className="space-y-1">
              <Label className="text-muted-foreground">Organization ID</Label>
              <div className="flex items-center gap-2">
                <code className="text-sm font-mono bg-muted px-2 py-1 rounded">
                  {org.id}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleCopyId}
                  title="Copy Organization ID"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Created Date */}
            <div className="space-y-1">
              <Label className="text-muted-foreground">Created</Label>
              {loading ? (
                <Skeleton className="h-5 w-40" />
              ) : (
                <p className="text-sm">
                  {orgDetails?.created_at
                    ? new Date(orgDetails.created_at).toLocaleDateString(
                        undefined,
                        {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        }
                      )
                    : "Unknown"}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-destructive">Danger Zone</CardTitle>
            <CardDescription>
              Irreversible actions for your organization.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Delete Organization</p>
                <p className="text-sm text-muted-foreground">
                  Permanently delete this organization and all its data.
                </p>
              </div>
              <Button
                variant="destructive"
                onClick={() => setDeleteOpen(true)}
              >
                Delete Organization
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Organization</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete your organization and all library
              data. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleting && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Delete Organization
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
