"use client";

import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  PerformancePayload,
  type PerformancePayloadType,
} from "@/lib/validators/performance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import {
  Trash2,
  ArrowUp,
  ArrowDown,
  X,
  Search,
} from "lucide-react";

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

function getEntryDisplayTitle(entry: any): string {
  const overrides = entry?.overrides as Record<string, unknown> | undefined;
  if (overrides?.title) return overrides.title as string;
  if (entry?.work?.work_name) return entry.work.work_name;
  return "Untitled";
}

function getEntryDisplayComposer(entry: any): string {
  const overrides = entry?.overrides as Record<string, unknown> | undefined;
  if (overrides?.composer_last_name) {
    const first = (overrides.composer_first_name as string) ?? "";
    const last = overrides.composer_last_name as string;
    return first ? `${first} ${last}` : last;
  }
  const composer = entry?.work?.composer;
  if (composer) {
    const c = Array.isArray(composer) ? composer[0] : composer;
    if (c) {
      return [c.first_name, c.last_name].filter(Boolean).join(" ");
    }
  }
  return "";
}

export default function PerformanceEditor({ initial, isNew, org }: Props) {
  const router = useRouter();
  const [perfId, setPerfId] = useState<string | null>(initial?.id ?? null);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved" | "error">(
    "idle"
  );
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const creatingRef = useRef(false);

  // Store library entry display info keyed by library_entry_id
  const [entryInfo, setEntryInfo] = useState<
    Record<string, { title: string; composer: string }>
  >(() => {
    const info: Record<string, { title: string; composer: string }> = {};
    if (initial?.performance_work) {
      for (const pw of initial.performance_work) {
        const entry = pw.library_entry;
        if (entry) {
          info[entry.id] = {
            title: getEntryDisplayTitle(entry),
            composer: getEntryDisplayComposer(entry),
          };
        }
      }
    }
    return info;
  });

  const defaultValues: PerformancePayloadType = {
    date: initial?.date ?? new Date().toISOString().slice(0, 10),
    event_name: initial?.event_name ?? "",
    venue: initial?.venue ?? "",
    season: initial?.season ?? "",
    notes: initial?.notes ?? "",
    works: (initial?.performance_work ?? [])
      .sort((a: any, b: any) => a.program_order - b.program_order)
      .map((pw: any) => ({
        library_entry_id: pw.library_entry_id,
        program_order: pw.program_order,
        notes: pw.notes ?? "",
      })),
  };

  const form = useForm<PerformancePayloadType>({
    defaultValues,
    resolver: zodResolver(PerformancePayload),
    mode: "onChange",
  });

  const { control, register, watch, setValue, getValues } = form;

  const worksField = useFieldArray({ control, name: "works" });

  // Create new performance on mount for /new
  useEffect(() => {
    if (isNew && !perfId && !creatingRef.current) {
      creatingRef.current = true;
      (async () => {
        const payload = {
          organization_id: org.id,
          date: getValues("date"),
          event_name: getValues("event_name") || "Untitled Performance",
        };
        const res = await fetch("/api/library/performances", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) return;
        const json = await res.json();
        setPerfId(json.id);
        router.replace(`/library/${org.slug}/performances/${json.id}`);
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew]);

  // Autosave (debounced on form values)
  const watched = watch();
  const debounced = useDebounced(watched, 800);

  useEffect(() => {
    if (!perfId) return;

    const doSave = async () => {
      setSaving("saving");
      const res = await fetch(`/api/library/performances/${perfId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...debounced,
          event_name: debounced.event_name?.trim() || "Untitled Performance",
          venue: debounced.venue?.trim() || null,
          season: debounced.season?.trim() || null,
          notes: debounced.notes?.trim() || null,
        }),
      });

      if (!res.ok) {
        setSaving("error");
        return;
      }

      setSaving("saved");
      setTimeout(() => setSaving("idle"), 1200);
    };

    doSave();
  }, [debounced, perfId]);

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

  const handleDelete = async () => {
    if (!perfId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/library/performances/${perfId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete performance");
      }
      router.push(`/library/${org.slug}/performances`);
    } catch (error) {
      console.error("Delete error:", error);
      alert(
        error instanceof Error ? error.message : "Failed to delete performance"
      );
      setDeleting(false);
    }
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    const works = getValues("works") ?? [];
    [works[index - 1], works[index]] = [works[index], works[index - 1]];
    works.forEach((w, i) => (w.program_order = i + 1));
    setValue("works", works);
  };

  const moveDown = (index: number) => {
    const works = getValues("works") ?? [];
    if (index >= works.length - 1) return;
    [works[index], works[index + 1]] = [works[index + 1], works[index]];
    works.forEach((w, i) => (w.program_order = i + 1));
    setValue("works", works);
  };

  const removeWork = (index: number) => {
    worksField.remove(index);
    // Reorder remaining works
    const works = getValues("works") ?? [];
    works.forEach((w, i) => (w.program_order = i + 1));
    setValue("works", works);
  };

  const addEntry = (entry: {
    id: string;
    title: string;
    composer: string;
  }) => {
    const currentWorks = getValues("works") ?? [];
    worksField.append({
      library_entry_id: entry.id,
      program_order: currentWorks.length + 1,
      notes: "",
    });
    setEntryInfo((prev) => ({
      ...prev,
      [entry.id]: { title: entry.title, composer: entry.composer },
    }));
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            {perfId ? "Edit Performance" : "New Performance"}
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
          {perfId && (
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
          <Button
            variant="outline"
            onClick={() =>
              router.push(`/library/${org.slug}/performances`)
            }
          >
            Back to List
          </Button>
        </div>
      </div>

      <Separator />

      {/* Form fields */}
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Date</Label>
            <Input type="date" {...register("date")} />
          </div>
          <div className="space-y-2">
            <Label>Event Name *</Label>
            <Input
              placeholder="e.g., Spring Concert"
              {...register("event_name")}
            />
            {form.formState.errors.event_name && (
              <p className="text-sm text-destructive">
                {form.formState.errors.event_name.message}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Venue</Label>
            <Input
              placeholder="e.g., Carnegie Hall"
              {...register("venue")}
            />
          </div>
          <div className="space-y-2">
            <Label>Season</Label>
            <Input
              placeholder="e.g., 2025-2026"
              {...register("season")}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Notes</Label>
          <Textarea
            rows={3}
            placeholder="Additional notes about this performance..."
            {...register("notes")}
          />
        </div>
      </div>

      <Separator />

      {/* Program builder */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Program</h2>
        </div>

        <EntrySearch orgId={org.id} onSelect={addEntry} />

        {/* Program list */}
        <div className="space-y-2">
          {worksField.fields.map((field, idx) => {
            const info = entryInfo[field.library_entry_id];
            return (
              <div
                key={field.id}
                className="flex items-start gap-3 rounded-md border p-3"
              >
                <div className="flex flex-col gap-1 pt-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => moveUp(idx)}
                    disabled={idx === 0}
                  >
                    <ArrowUp className="h-3 w-3" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => moveDown(idx)}
                    disabled={idx === worksField.fields.length - 1}
                  >
                    <ArrowDown className="h-3 w-3" />
                  </Button>
                </div>

                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-muted-foreground w-6">
                      {idx + 1}.
                    </span>
                    <div className="flex-1">
                      <p className="font-medium text-sm">
                        {info?.title ?? "Unknown work"}
                      </p>
                      {info?.composer && (
                        <p className="text-xs text-muted-foreground">
                          {info.composer}
                        </p>
                      )}
                    </div>
                  </div>
                  <Input
                    placeholder="Notes for this work (optional)"
                    {...register(`works.${idx}.notes` as const)}
                    className="text-sm"
                  />
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => removeWork(idx)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            );
          })}

          {worksField.fields.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              No works in the program yet. Use the search above to add entries
              from your catalog.
            </p>
          )}
        </div>
      </div>

      {/* Delete dialog */}
      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Performance?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this performance? This action
              cannot be undone. All program entries will also be deleted.
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

/** Typeahead search for library entries */
function EntrySearch({
  orgId,
  onSelect,
}: {
  orgId: string;
  onSelect: (entry: {
    id: string;
    title: string;
    composer: string;
  }) => void;
}) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<
    { id: string; title: string; composer: string }[]
  >([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!q.trim()) {
      setItems([]);
      return;
    }

    const t = setTimeout(async () => {
      const res = await fetch(
        `/api/library/entries/search?organization_id=${encodeURIComponent(orgId)}&q=${encodeURIComponent(q)}&limit=10`
      );
      if (!res.ok) return;
      const json = await res.json();
      const entries = (json.entries ?? []).map((entry: any) => {
        const overrides = entry.overrides as Record<string, unknown> | undefined;
        let title = "Untitled";
        if (overrides?.title) {
          title = overrides.title as string;
        } else if (entry.work?.work_name) {
          title = entry.work.work_name;
        }

        let composer = "";
        if (overrides?.composer_last_name) {
          const first = (overrides.composer_first_name as string) ?? "";
          const last = overrides.composer_last_name as string;
          composer = first ? `${first} ${last}` : last;
        } else if (entry.work?.composer) {
          const c = Array.isArray(entry.work.composer)
            ? entry.work.composer[0]
            : entry.work.composer;
          if (c) {
            composer = [c.first_name, c.last_name].filter(Boolean).join(" ");
          }
        }

        return { id: entry.id, title, composer };
      });
      setItems(entries);
      setOpen(entries.length > 0);
    }, 250);

    return () => clearTimeout(t);
  }, [q, orgId]);

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search catalog to add works..."
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            if (!e.target.value.trim()) setOpen(false);
          }}
          onFocus={() => {
            if (items.length > 0) setOpen(true);
          }}
          className="pl-9"
        />
      </div>
      {open && items.length > 0 && (
        <div className="absolute z-10 mt-1 w-full border rounded-md bg-popover shadow-md max-h-60 overflow-auto">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              className="w-full text-left px-3 py-2 hover:bg-accent text-sm"
              onClick={() => {
                onSelect(item);
                setQ("");
                setItems([]);
                setOpen(false);
              }}
            >
              <span className="font-medium">{item.title}</span>
              {item.composer && (
                <span className="text-muted-foreground ml-2">
                  {item.composer}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
