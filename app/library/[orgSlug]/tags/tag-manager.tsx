"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
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
import { Pencil, Trash2, Plus, Tag, Loader2 } from "lucide-react";

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

type LibraryTag = {
  id: string;
  name: string;
  category: string | null;
  color: string | null;
  entry_count: number;
};

type TagFormData = {
  name: string;
  category: string;
  color: string;
};

// ---------------------------------------------------------------------------
// Color presets
// ---------------------------------------------------------------------------

const colorPresets = [
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#3b82f6", // blue
  "#8b5cf6", // purple
  "#ec4899", // pink
  "#6b7280", // gray
];

const emptyForm: TagFormData = { name: "", category: "", color: "" };

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TagManager({ org }: { org: OrgInfo }) {
  const [tags, setTags] = useState<LibraryTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<LibraryTag | null>(null);
  const [form, setForm] = useState<TagFormData>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<LibraryTag | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ---------------------------------------------------------------------------
  // Fetch tags
  // ---------------------------------------------------------------------------

  const fetchTags = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/library/tags?organization_id=${org.id}`
      );
      if (res.ok) {
        const data = await res.json();
        setTags(data.tags ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [org.id]);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  // ---------------------------------------------------------------------------
  // Open dialog for create / edit
  // ---------------------------------------------------------------------------

  function openCreate() {
    setEditingTag(null);
    setForm(emptyForm);
    setFormError(null);
    setDialogOpen(true);
  }

  function openEdit(tag: LibraryTag) {
    setEditingTag(tag);
    setForm({
      name: tag.name,
      category: tag.category ?? "",
      color: tag.color ?? "",
    });
    setFormError(null);
    setDialogOpen(true);
  }

  // ---------------------------------------------------------------------------
  // Save (create or update)
  // ---------------------------------------------------------------------------

  async function handleSave() {
    const trimmedName = form.name.trim();
    if (!trimmedName) {
      setFormError("Tag name is required.");
      return;
    }

    setSaving(true);
    setFormError(null);

    const payload: Record<string, unknown> = {
      name: trimmedName,
      category: form.category.trim() || null,
      color: form.color.trim() || null,
    };

    try {
      let res: Response;

      if (editingTag) {
        // PATCH existing tag
        res = await fetch(`/api/library/tags/${editingTag.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        // POST new tag
        payload.organization_id = org.id;
        res = await fetch("/api/library/tags", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setFormError(
          data?.error ?? `Failed to ${editingTag ? "update" : "create"} tag.`
        );
        return;
      }

      setDialogOpen(false);
      await fetchTags();
    } finally {
      setSaving(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------------

  async function handleDelete() {
    if (!deleteTarget) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/library/tags/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setDeleteTarget(null);
        await fetchTags();
      }
    } finally {
      setDeleting(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Tags</h1>
          <p className="text-zinc-500 mt-1">
            Manage tags for organizing your library entries.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Create Tag
        </Button>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
        </div>
      )}

      {/* Empty state */}
      {!loading && tags.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Tag className="h-10 w-10 text-zinc-300 mb-4" />
            <p className="text-zinc-500 mb-4">
              No tags yet. Create your first tag.
            </p>
            <Button variant="outline" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Create Tag
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Tag list */}
      {!loading && tags.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {tags.map((tag) => (
            <Card key={tag.id} className="group">
              <CardContent className="flex items-center gap-3 py-4">
                {/* Color dot */}
                <span
                  className="inline-block h-4 w-4 rounded-full shrink-0 border border-zinc-200 dark:border-zinc-700"
                  style={{
                    backgroundColor: tag.color || "#6b7280",
                  }}
                />

                {/* Name + category */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{tag.name}</p>
                  {tag.category && (
                    <p className="text-xs text-zinc-400 truncate">
                      {tag.category}
                    </p>
                  )}
                </div>

                {/* Entry count */}
                <span className="text-xs text-zinc-400 whitespace-nowrap">
                  {tag.entry_count}{" "}
                  {tag.entry_count === 1 ? "entry" : "entries"}
                </span>

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => openEdit(tag)}
                    title="Edit tag"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => setDeleteTarget(tag)}
                    title="Delete tag"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingTag ? "Edit Tag" : "Create Tag"}
            </DialogTitle>
            <DialogDescription>
              {editingTag
                ? "Update the tag details below."
                : "Fill in the details to create a new tag."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="tag-name">Name *</Label>
              <Input
                id="tag-name"
                placeholder="e.g. Holiday Concert"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSave();
                  }
                }}
              />
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label htmlFor="tag-category">Category</Label>
              <Input
                id="tag-category"
                placeholder="e.g. Season, Genre, Difficulty"
                value={form.category}
                onChange={(e) =>
                  setForm((f) => ({ ...f, category: e.target.value }))
                }
              />
            </div>

            {/* Color */}
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {colorPresets.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`h-7 w-7 rounded-full border-2 transition-all ${
                      form.color === c
                        ? "border-zinc-900 dark:border-white scale-110"
                        : "border-transparent hover:scale-105"
                    }`}
                    style={{ backgroundColor: c }}
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        color: f.color === c ? "" : c,
                      }))
                    }
                    title={c}
                  />
                ))}
              </div>
              <Input
                placeholder="#hexcolor"
                value={form.color}
                onChange={(e) =>
                  setForm((f) => ({ ...f, color: e.target.value }))
                }
                className="mt-2"
              />
            </div>

            {/* Error */}
            {formError && (
              <p className="text-sm text-destructive">{formError}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingTag ? "Save Changes" : "Create Tag"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Tag</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the tag &ldquo;
              {deleteTarget?.name}&rdquo;? This will remove it from all
              library entries. This action cannot be undone.
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
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
