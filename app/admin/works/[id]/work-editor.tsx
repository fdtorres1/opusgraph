"use client";

import * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { WorkPayload, type WorkPayloadType } from "@/lib/validators/work";
import { formatDuration } from "@/lib/duration";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, } from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";

type Props = {
  initial: any | null;
  isNew: boolean;
  ensembles: { id: string; label: string }[];
};

const useDebounced = (value: any, delay = 700) => {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
};

export default function WorkEditor({ initial, isNew, ensembles }: Props) {
  const router = useRouter();
  const [workId, setWorkId] = useState<string | null>(initial?.id ?? null);
  const [saving, setSaving] = useState<"idle"|"saving"|"saved"|"error">("idle");
  const [showDiscard, setShowDiscard] = useState(false);
  const lastSavedRef = useRef<any>(initial);

  const defaultValues: WorkPayloadType = {
    work_name: initial?.work_name ?? "",
    composition_year: initial?.composition_year ? String(initial.composition_year) : "",
    composer_id: initial?.composer_id ?? undefined,
    ensemble_id: initial?.ensemble_id ?? undefined,
    instrumentation_text: initial?.instrumentation_text ?? "",
    duration: formatDuration(initial?.duration_seconds ?? null),
    publisher_id: initial?.publisher_id ?? undefined,
    status: initial?.status ?? "draft",
    sources: (initial?.work_source ?? []).sort((a: any,b: any)=>a.display_order-b.display_order).map((s: any) => ({
      id: s.id, url: s.url, title: s.title ?? "", display_order: s.display_order ?? 0
    })),
    recordings: (initial?.work_recording ?? []).sort((a:any,b:any)=>a.display_order-b.display_order).map((r:any) => ({
      id: r.id, url: r.url, display_order: r.display_order ?? 0
    })),
  };

  const form = useForm<WorkPayloadType>({ defaultValues, resolver: zodResolver(WorkPayload), mode: "onChange" });
  const { control, register, watch, setValue, getValues, reset } = form;

  const sources = useFieldArray({ control, name: "sources" });
  const recordings = useFieldArray({ control, name: "recordings" });

  // Create new Draft row on mount for /new
  useEffect(() => {
    if (isNew && !workId) {
      (async () => {
        const res = await fetch("/api/admin/works", { method: "POST" });
        if (!res.ok) return;
        const json = await res.json();
        setWorkId(json.id);
        // push new URL with id to make refresh safe
        router.replace(`/admin/works/${json.id}`);
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew]);

  // Autosave (debounced on form values)
  const watched = watch();
  const debounced = useDebounced(watched, 800);

  useEffect(() => {
    if (!workId) return;

    const doSave = async () => {
      setSaving("saving");
      const res = await fetch(`/api/admin/works/${workId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...debounced,
          // empty strings -> null
          work_name: debounced.work_name?.trim() || null,
          composition_year: debounced.composition_year?.trim() || null,
          instrumentation_text: debounced.instrumentation_text?.trim() || null,
          duration: debounced.duration?.trim() || null,
        }),
      });

      if (!res.ok) { setSaving("error"); return; }

      const json = await res.json();
      lastSavedRef.current = json.work;
      setSaving("saved");
      setTimeout(() => setSaving("idle"), 1200);
    };

    doSave();
  }, [debounced, workId]);

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

  const statusIsPublished = watch("status") === "published";

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{workId ? "Edit Work" : "New Work"}</h1>
          <p className="text-sm text-muted-foreground">
            {saving === "saving" ? "Saving…" : saving === "saved" ? "Saved" : saving === "error" ? "Error saving" : "Autosave ready"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Label htmlFor="status-switch">Draft / Published</Label>
            <Switch
              id="status-switch"
              checked={statusIsPublished}
              onCheckedChange={(v) => form.setValue("status", v ? "published" : "draft")}
            />
            <Badge variant={statusIsPublished ? "default" : "secondary"}>{statusIsPublished ? "Published" : "Draft"}</Badge>
          </div>
          <Button variant="destructive" onClick={() => setShowDiscard(true)}>Cancel</Button>
          <Button onClick={() => form.trigger() /* manual save happens via autosave cycle */}>Save</Button>
        </div>
      </div>

      <Separator />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="md:col-span-2 space-y-6">
          <div className="space-y-2">
            <Label>Work Name</Label>
            <Input placeholder="e.g., Symphony No. 3" {...register("work_name")} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Composition Year</Label>
              <Input placeholder="YYYY" {...register("composition_year")} />
            </div>
            <div>
              <Label>Duration</Label>
              <Input placeholder="MM:SS or HH:MM:SS" {...register("duration")} />
            </div>
            <div>
              <Label>Ensemble</Label>
              <Select
                value={watch("ensemble_id") ?? ""}
                onValueChange={(v) => setValue("ensemble_id", v || undefined)}
              >
                <SelectTrigger><SelectValue placeholder="Select ensemble" /></SelectTrigger>
                <SelectContent>
                  {ensembles.map(e => <SelectItem key={e.id} value={e.id}>{e.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Instrumentation</Label>
            <Textarea rows={4} placeholder="Free text (e.g., 2.2.2.2 – 4.3.3.1 – timp, perc(2) – strings)…" {...register("instrumentation_text")} />
          </div>

          {/* Sources */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Sources</Label>
              <Button type="button" variant="secondary" onClick={() => sources.append({ url: "", title: "" })}>+ Add Source</Button>
            </div>
            <div className="space-y-3">
              {sources.fields.map((field, idx) => (
                <div key={field.id} className="grid grid-cols-1 md:grid-cols-8 gap-2">
                  <Input className="md:col-span-5" placeholder="https://…" {...register(`sources.${idx}.url` as const)} />
                  <Input className="md:col-span-2" placeholder="Title (optional)" {...register(`sources.${idx}.title` as const)} />
                  <Button type="button" variant="ghost" onClick={() => sources.remove(idx)}>Remove</Button>
                </div>
              ))}
            </div>
          </div>

          {/* Recordings */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Recordings</Label>
              <Button type="button" variant="secondary" onClick={() => recordings.append({ url: "" })}>+ Add Recording</Button>
            </div>
            <div className="space-y-4">
              {recordings.fields.map((field, idx) => {
                const url = watch(`recordings.${idx}.url` as const) || "";
                // Embed preview (client-side only; server stores embed_url)
                let embed: React.ReactNode = null;
                try {
                  const u = new URL(url);
                  if (u.hostname.includes("youtu")) {
                    const id = u.searchParams.get("v") || u.pathname.split("/").filter(Boolean).pop();
                    if (id) embed = <iframe className="w-full aspect-video" src={`https://www.youtube.com/embed/${id}`} allow="autoplay; encrypted-media" />;
                  } else if (u.hostname.includes("spotify.com")) {
                    embed = <iframe className="w-full h-20" src={`https://open.spotify.com/embed${u.pathname}`} allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" />;
                  } else if (u.hostname.includes("music.apple.com")) {
                    embed = <iframe className="w-full h-80" src={`https://embed.music.apple.com${u.pathname}`} allow="autoplay *; encrypted-media *;" />;
                  } else if (u.hostname.includes("soundcloud.com")) {
                    embed = <iframe className="w-full h-20" src={`https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}`} />;
                  }
                } catch { /* ignore */ }

                return (
                  <div key={field.id} className="space-y-2">
                    <div className="flex gap-2">
                      <Input placeholder="https://…" {...register(`recordings.${idx}.url` as const)} />
                      <Button type="button" variant="ghost" onClick={() => recordings.remove(idx)}>Remove</Button>
                    </div>
                    {embed}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right column (relations) */}
        <div className="space-y-6">
          {/* Composer combobox */}
          <div className="space-y-2">
            <Label>Composer</Label>
            <Typeahead endpoint="/api/admin/search/composers" placeholder="Search composer…" value={watch("composer_id") ?? ""} onSelect={(id) => setValue("composer_id", id)} />
          </div>

          {/* Publisher combobox */}
          <div className="space-y-2">
            <Label>Publisher</Label>
            <Typeahead endpoint="/api/admin/search/publishers" placeholder="Search publisher…" value={watch("publisher_id") ?? ""} onSelect={(id) => setValue("publisher_id", id)} />
          </div>
        </div>
      </div>

      {/* Discard dialog */}
      <AlertDialog open={showDiscard} onOpenChange={setShowDiscard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard changes?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to discard changes? Unsaved edits will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowDiscard(false)}>Keep Editing</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (lastSavedRef.current) {
                // Reset to last saved snapshot
                reset({
                  work_name: lastSavedRef.current.work_name ?? "",
                  composition_year: lastSavedRef.current.composition_year ? String(lastSavedRef.current.composition_year) : "",
                  composer_id: lastSavedRef.current.composer_id ?? undefined,
                  ensemble_id: lastSavedRef.current.ensemble_id ?? undefined,
                  instrumentation_text: lastSavedRef.current.instrumentation_text ?? "",
                  duration: formatDuration(lastSavedRef.current.duration_seconds ?? null),
                  publisher_id: lastSavedRef.current.publisher_id ?? undefined,
                  status: lastSavedRef.current.status ?? "draft",
                  sources: [],
                  recordings: [],
                });
              } else {
                // brand new -> navigate away
                router.push("/admin");
              }
              setShowDiscard(false);
            }}>Discard</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Simple fetch-based typeahead */
function Typeahead({ endpoint, placeholder, value, onSelect }: {
  endpoint: string; placeholder?: string;
  value: string; onSelect: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<{ id: string; label: string }[]>([]);

  useEffect(() => {
    const t = setTimeout(async () => {
      const res = await fetch(`${endpoint}?q=${encodeURIComponent(q)}`);
      if (!res.ok) return;
      const json = await res.json();
      setItems(json.results ?? []);
    }, 250);

    return () => clearTimeout(t);
  }, [q, endpoint]);

  return (
    <div className="space-y-2">
      <Input placeholder={placeholder} value={q} onChange={(e) => setQ(e.target.value)} />
      {items.length > 0 && (
        <div className="border rounded-md max-h-48 overflow-auto">
          {items.map((it) => (
            <button
              key={it.id}
              className="w-full text-left px-3 py-2 hover:bg-accent"
              onClick={() => { onSelect(it.id); setQ(it.label); setItems([]); }}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
      {value && q === "" && <p className="text-xs text-muted-foreground">Selected ID: {value}</p>}
    </div>
  );
}

