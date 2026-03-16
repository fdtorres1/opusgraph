"use client";

import * as React from "react";
import { useEffect, useRef, useState, useCallback } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  LibraryEntryPayload,
  type LibraryEntryPayloadType,
} from "@/lib/validators/library-entry";
import { conditionOptions } from "@/lib/library";
import { formatDuration, parseDuration } from "@/lib/duration";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import { Separator } from "@/components/ui/separator";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Trash2, Plus, X, Search, Unlink } from "lucide-react";

type Props = {
  initial: any | null;
  isNew: boolean;
  org: { id: string; slug: string; name: string };
};

const useDebounced = (value: any, delay = 700) => {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
};

/** Returns black or white depending on which has better contrast with the given hex color. */
function getContrastColor(hex: string): string {
  const c = hex.replace("#", "");
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  // YIQ formula
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 128 ? "#000000" : "#ffffff";
}

export default function LibraryEntryEditor({ initial, isNew, org }: Props) {
  const router = useRouter();
  const [entryId, setEntryId] = useState<string | null>(initial?.id ?? null);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved" | "error">(
    "idle"
  );
  const [showDiscard, setShowDiscard] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const lastSavedRef = useRef<any>(initial);
  // Track whether the initial autosave has been skipped
  const isFirstRender = useRef(true);

  // Reference work search state
  const [refQuery, setRefQuery] = useState("");
  const [refResults, setRefResults] = useState<any[]>([]);
  const [refSearching, setRefSearching] = useState(false);
  const [linkedWork, setLinkedWork] = useState<any>(initial?.work || null);

  // Tags state
  const [entryTags, setEntryTags] = useState<
    Array<{ id: string; name: string; color: string | null }>
  >(initial?.library_entry_tag?.map((t: any) => t.library_tag) || []);
  const [availableTags, setAvailableTags] = useState<any[]>([]);
  const [tagQuery, setTagQuery] = useState("");
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
  const tagInputRef = useRef<HTMLInputElement>(null);
  const tagDropdownRef = useRef<HTMLDivElement>(null);

  const defaultValues: LibraryEntryPayloadType = initial
    ? {
        reference_work_id: initial.reference_work_id ?? null,
        overrides: initial.overrides ?? {},
        copies_owned: initial.copies_owned ?? 0,
        location: initial.location ?? "",
        condition: initial.condition ?? null,
        notes: initial.notes ?? "",
        parts: (initial.library_entry_part ?? []).map((p: any) => ({
          id: p.id,
          part_name: p.part_name ?? "",
          quantity: p.quantity ?? 1,
          condition: p.condition ?? null,
          notes: p.notes ?? "",
        })),
      }
    : {
        reference_work_id: null,
        overrides: {},
        copies_owned: 0,
        location: "",
        condition: null,
        notes: "",
        parts: [],
      };

  // Store a formatted duration string for the override duration field
  const [durationStr, setDurationStr] = useState(
    formatDuration(initial?.overrides?.duration ?? null)
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const form = useForm<LibraryEntryPayloadType>({
    defaultValues,
    resolver: zodResolver(LibraryEntryPayload) as any,
    mode: "onChange",
  });

  const { control, register, watch, setValue, reset } = form;

  const {
    fields: partFields,
    append: appendPart,
    remove: removePart,
  } = useFieldArray({
    control,
    name: "parts",
  });

  // Create new entry on mount for /new
  useEffect(() => {
    if (isNew && !entryId) {
      (async () => {
        const res = await fetch("/api/library/entries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ organization_id: org.id }),
        });
        if (!res.ok) return;
        const json = await res.json();
        setEntryId(json.id);
        router.replace(`/library/${org.slug}/catalog/${json.id}`);
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew]);

  // Fetch available org tags on mount
  useEffect(() => {
    fetch(`/api/library/tags?organization_id=${org.id}`)
      .then((r) => r.json())
      .then((d) => setAvailableTags(d.tags || []))
      .catch(() => {});
  }, [org.id]);

  // Autosave (debounced on form values)
  const watched = watch();
  const debounced = useDebounced(watched, 800);

  useEffect(() => {
    // Skip the initial render to avoid saving on page load
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (!entryId) return;

    const doSave = async () => {
      setSaving("saving");
      try {
        const res = await fetch(`/api/library/entries/${entryId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...debounced,
            // Clean up empty strings -> null for optional fields
            location: debounced.location?.trim() || null,
            notes: debounced.notes?.trim() || null,
            condition: debounced.condition || null,
          }),
        });

        if (!res.ok) {
          setSaving("error");
          return;
        }

        const json = await res.json();
        lastSavedRef.current = json.entry;
        setSaving("saved");
        setTimeout(() => setSaving("idle"), 1200);
      } catch {
        setSaving("error");
      }
    };

    doSave();
  }, [debounced, entryId]);

  // beforeunload guard
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (saving === "saving") {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [saving]);

  // Close tag dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        tagDropdownRef.current &&
        !tagDropdownRef.current.contains(e.target as Node) &&
        tagInputRef.current &&
        !tagInputRef.current.contains(e.target as Node)
      ) {
        setTagDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Handle duration string -> seconds conversion
  const handleDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setDurationStr(val);
    const seconds = parseDuration(val);
    if (seconds !== null) {
      setValue("overrides.duration", seconds);
    } else if (val === "") {
      setValue("overrides.duration", undefined);
    }
  };

  // Reference work typeahead search (250ms debounce)
  useEffect(() => {
    if (!refQuery.trim()) {
      setRefResults([]);
      setRefSearching(false);
      return;
    }
    setRefSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/library/reference/search?q=${encodeURIComponent(refQuery.trim())}`
        );
        if (!res.ok) return;
        const json = await res.json();
        setRefResults(json.results ?? []);
      } catch {
        // silently ignore fetch errors
      } finally {
        setRefSearching(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [refQuery]);

  const handleSelectReferenceWork = (work: any) => {
    setValue("reference_work_id", work.id);
    setLinkedWork(work);
    setRefQuery("");
    setRefResults([]);
  };

  const handleUnlinkReferenceWork = () => {
    setValue("reference_work_id", null);
    setLinkedWork(null);
  };

  // Helper to get a display name for the composer from a reference work
  const refComposerName = (work: any) => {
    if (!work?.composer) return "";
    const c = work.composer;
    return [c.first_name, c.last_name].filter(Boolean).join(" ");
  };

  // Tags: save via PUT endpoint
  const saveTags = useCallback(
    async (tags: Array<{ id: string }>) => {
      if (!entryId) return;
      await fetch(`/api/library/entries/${entryId}/tags`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag_ids: tags.map((t) => t.id) }),
      });
    },
    [entryId]
  );

  const handleAddTag = useCallback(
    (tag: { id: string; name: string; color: string | null }) => {
      const updated = [...entryTags, tag];
      setEntryTags(updated);
      setTagQuery("");
      setTagDropdownOpen(false);
      saveTags(updated);
    },
    [entryTags, saveTags]
  );

  const handleRemoveTag = useCallback(
    (tagId: string) => {
      const updated = entryTags.filter((t) => t.id !== tagId);
      setEntryTags(updated);
      saveTags(updated);
    },
    [entryTags, saveTags]
  );

  // Filter available tags: match query, exclude already-assigned
  const assignedIds = new Set(entryTags.map((t) => t.id));
  const filteredTags = availableTags.filter(
    (t) =>
      !assignedIds.has(t.id) &&
      t.name.toLowerCase().includes(tagQuery.toLowerCase())
  );

  const handleDelete = async () => {
    if (!entryId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/library/entries/${entryId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete entry");
      }
      router.push(`/library/${org.slug}/catalog`);
    } catch (error) {
      console.error("Delete error:", error);
      alert(
        error instanceof Error ? error.message : "Failed to delete entry"
      );
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-5xl space-y-6">
      {/* Header / status bar */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            {entryId ? "Edit Library Entry" : "New Library Entry"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {saving === "saving"
              ? "Saving..."
              : saving === "saved"
                ? "Saved"
                : saving === "error"
                  ? "Error saving"
                  : "Autosave ready"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {entryId && (
            <Button
              type="button"
              variant="destructive"
              onClick={() => setShowDelete(true)}
              disabled={deleting}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          )}
          <Button variant="outline" onClick={() => setShowDiscard(true)}>
            Discard
          </Button>
        </div>
      </div>

      <Separator />

      {/* Reference Work Link */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <h2 className="text-lg font-medium">Works Database Link</h2>

          {linkedWork ? (
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant="secondary" className="text-sm py-1 px-3">
                Linked to: {linkedWork.work_name}
                {refComposerName(linkedWork)
                  ? ` by ${refComposerName(linkedWork)}`
                  : ""}
              </Badge>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleUnlinkReferenceWork}
              >
                <Unlink className="h-4 w-4 mr-1" />
                Unlink
              </Button>
            </div>
          ) : (
            <div className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search the Works Database..."
                  value={refQuery}
                  onChange={(e) => setRefQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              {refSearching && (
                <p className="text-xs text-muted-foreground mt-1">
                  Searching...
                </p>
              )}
              {refResults.length > 0 && (
                <div className="absolute z-10 w-full mt-1 border rounded-md bg-popover shadow-md max-h-60 overflow-auto">
                  {refResults.map((work: any) => (
                    <button
                      key={work.id}
                      type="button"
                      className="w-full text-left px-3 py-2 hover:bg-accent border-b last:border-b-0"
                      onClick={() => handleSelectReferenceWork(work)}
                    >
                      <div className="font-medium">{work.work_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {[
                          refComposerName(work),
                          work.instrumentation_text,
                        ]
                          .filter(Boolean)
                          .join(" \u2014 ")}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {refQuery.trim() && !refSearching && refResults.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  No works found.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Core metadata (override fields) */}
      <div className="space-y-6">
        <h2 className="text-lg font-medium">Metadata</h2>
        <div className="space-y-2">
          <Label>Title</Label>
          <Input
            placeholder={
              linkedWork?.work_name || "e.g., Symphony No. 3"
            }
            {...register("overrides.title")}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Composer First Name</Label>
            <Input
              placeholder={
                linkedWork?.composer?.first_name || "e.g., Ludwig"
              }
              {...register("overrides.composer_first_name")}
            />
          </div>
          <div className="space-y-2">
            <Label>Composer Last Name</Label>
            <Input
              placeholder={
                linkedWork?.composer?.last_name || "e.g., van Beethoven"
              }
              {...register("overrides.composer_last_name")}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Arranger</Label>
            <Input
              placeholder="Arranger name"
              {...register("overrides.arranger")}
            />
          </div>
          <div className="space-y-2">
            <Label>Publisher</Label>
            <Input
              placeholder="Publisher name"
              {...register("overrides.publisher")}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Instrumentation</Label>
          <Input
            placeholder="e.g., 2.2.2.2 - 4.3.3.1 - timp, perc - strings"
            {...register("overrides.instrumentation")}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Duration</Label>
            <Input
              placeholder="MM:SS or HH:MM:SS"
              value={durationStr}
              onChange={handleDurationChange}
            />
          </div>
          <div className="space-y-2">
            <Label>Year Composed</Label>
            <Input
              type="number"
              placeholder="e.g., 1804"
              {...register("overrides.year_composed", { valueAsNumber: true })}
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Library-specific fields */}
      <div className="space-y-6">
        <h2 className="text-lg font-medium">Library Details</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Copies Owned</Label>
            <Input
              type="number"
              min={0}
              {...register("copies_owned", { valueAsNumber: true })}
            />
          </div>
          <div className="space-y-2">
            <Label>Location</Label>
            <Input
              placeholder="e.g., Shelf A, Cabinet 3"
              {...register("location")}
            />
          </div>
          <div className="space-y-2">
            <Label>Condition</Label>
            <Select
              value={watch("condition") ?? ""}
              onValueChange={(v) =>
                setValue("condition", (v || null) as any)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select condition" />
              </SelectTrigger>
              <SelectContent>
                {conditionOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Notes</Label>
          <Textarea
            rows={3}
            placeholder="Any notes about this library entry..."
            {...register("notes")}
          />
        </div>
      </div>

      <Separator />

      {/* Parts section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Parts</h2>
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              appendPart({
                part_name: "",
                quantity: 1,
                condition: null,
                notes: "",
              })
            }
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Part
          </Button>
        </div>

        {partFields.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No parts added yet. Click &quot;Add Part&quot; to add one.
          </p>
        )}

        <div className="space-y-3">
          {partFields.map((field, idx) => (
            <div
              key={field.id}
              className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end"
            >
              <div className="md:col-span-4 space-y-1">
                {idx === 0 && (
                  <Label className="text-xs text-muted-foreground">
                    Part Name
                  </Label>
                )}
                <Input
                  placeholder="e.g., Flute 1"
                  {...register(`parts.${idx}.part_name` as const)}
                />
              </div>
              <div className="md:col-span-2 space-y-1">
                {idx === 0 && (
                  <Label className="text-xs text-muted-foreground">
                    Quantity
                  </Label>
                )}
                <Input
                  type="number"
                  min={0}
                  {...register(`parts.${idx}.quantity` as const, {
                    valueAsNumber: true,
                  })}
                />
              </div>
              <div className="md:col-span-2 space-y-1">
                {idx === 0 && (
                  <Label className="text-xs text-muted-foreground">
                    Condition
                  </Label>
                )}
                <Select
                  value={watch(`parts.${idx}.condition`) ?? ""}
                  onValueChange={(v) =>
                    setValue(
                      `parts.${idx}.condition`,
                      (v || null) as any
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Condition" />
                  </SelectTrigger>
                  <SelectContent>
                    {conditionOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-3 space-y-1">
                {idx === 0 && (
                  <Label className="text-xs text-muted-foreground">
                    Notes
                  </Label>
                )}
                <Input
                  placeholder="Notes"
                  {...register(`parts.${idx}.notes` as const)}
                />
              </div>
              <div className="md:col-span-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removePart(idx)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tags section — only shown after entry is created */}
      {entryId && (
        <>
          <Separator />

          <div className="space-y-4">
            <h2 className="text-lg font-medium">Tags</h2>

            {/* Current tags as colored badges */}
            {entryTags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {entryTags.map((tag) => (
                  <Badge
                    key={tag.id}
                    className="text-sm py-1 px-3 gap-1"
                    style={
                      tag.color
                        ? {
                            backgroundColor: tag.color,
                            color: getContrastColor(tag.color),
                            borderColor: tag.color,
                          }
                        : undefined
                    }
                  >
                    {tag.name}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag.id)}
                      className="ml-1 hover:opacity-70 inline-flex items-center"
                      aria-label={`Remove tag ${tag.name}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            {/* Tag search input */}
            <div className="relative max-w-sm">
              <Input
                ref={tagInputRef}
                placeholder="Search tags to add..."
                value={tagQuery}
                onChange={(e) => {
                  setTagQuery(e.target.value);
                  setTagDropdownOpen(true);
                }}
                onFocus={() => setTagDropdownOpen(true)}
              />
              {tagDropdownOpen && filteredTags.length > 0 && (
                <div
                  ref={tagDropdownRef}
                  className="absolute z-10 w-full mt-1 border rounded-md bg-popover shadow-md max-h-48 overflow-auto"
                >
                  {filteredTags.map((tag) => (
                    <button
                      key={tag.id}
                      type="button"
                      className="w-full text-left px-3 py-2 hover:bg-accent border-b last:border-b-0 flex items-center gap-2"
                      onClick={() => handleAddTag(tag)}
                    >
                      {tag.color && (
                        <span
                          className="inline-block h-3 w-3 rounded-full shrink-0"
                          style={{ backgroundColor: tag.color }}
                        />
                      )}
                      <span>{tag.name}</span>
                    </button>
                  ))}
                </div>
              )}
              {tagDropdownOpen &&
                tagQuery.trim() &&
                filteredTags.length === 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    No matching tags found.
                  </p>
                )}
            </div>

            {entryTags.length === 0 && !tagDropdownOpen && (
              <p className="text-sm text-muted-foreground">
                No tags assigned. Use the search above to add tags.
              </p>
            )}
          </div>
        </>
      )}

      {/* Discard dialog */}
      <AlertDialog open={showDiscard} onOpenChange={setShowDiscard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard changes?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to discard changes? Unsaved edits will be
              lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowDiscard(false)}>
              Keep Editing
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (lastSavedRef.current) {
                  const saved = lastSavedRef.current;
                  reset({
                    reference_work_id: saved.reference_work_id ?? null,
                    overrides: saved.overrides ?? {},
                    copies_owned: saved.copies_owned ?? 0,
                    location: saved.location ?? "",
                    condition: saved.condition ?? null,
                    notes: saved.notes ?? "",
                    parts: (saved.library_entry_part ?? saved.parts ?? []).map(
                      (p: any) => ({
                        id: p.id,
                        part_name: p.part_name ?? "",
                        quantity: p.quantity ?? 1,
                        condition: p.condition ?? null,
                        notes: p.notes ?? "",
                      })
                    ),
                  });
                  setDurationStr(
                    formatDuration(saved.overrides?.duration ?? null)
                  );
                } else {
                  router.push(`/library/${org.slug}/catalog`);
                }
                setShowDiscard(false);
              }}
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete dialog */}
      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Library Entry?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this library entry? This action
              cannot be undone. All related parts and tags will also be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => setShowDelete(false)}
              disabled={deleting}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
