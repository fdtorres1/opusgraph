"use client";

import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ComposerPayload, type ComposerPayloadType } from "@/lib/validators/composer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, } from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";
import { LocationSearch } from "@/components/location-search";
import { Trash2 } from "lucide-react";

type Props = {
  initial: any | null;
  isNew: boolean;
  genders: { id: string; label: string }[];
  countries: { iso2: string; name: string }[];
};

const useDebounced = (value: any, delay = 700) => {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
};

export default function ComposerEditor({ initial, isNew, genders, countries }: Props) {
  const router = useRouter();
  const [composerId, setComposerId] = useState<string | null>(initial?.id ?? null);
  const [saving, setSaving] = useState<"idle"|"saving"|"saved"|"error">("idle");
  const [showDiscard, setShowDiscard] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const lastSavedRef = useRef<any>(initial);

  const defaultValues: ComposerPayloadType = {
    first_name: initial?.first_name ?? "",
    last_name: initial?.last_name ?? "",
    birth_year: initial?.birth_year ? String(initial.birth_year) : "",
    birth_place_id: initial?.birth_place_id ?? undefined,
    death_year: initial?.death_year ? String(initial.death_year) : "",
    death_place_id: initial?.death_place_id ?? undefined,
    gender_id: initial?.gender_id ?? undefined,
    gender_self_describe: initial?.gender_self_describe ?? "",
    status: initial?.status ?? "draft",
    nationalities: (initial?.composer_nationality ?? []).map((n: any) => n.country_iso2),
    links: (initial?.composer_link ?? []).sort((a: any,b: any)=>a.display_order-b.display_order).map((l: any) => ({
      id: l.id, url: l.url, is_primary: l.is_primary ?? false, display_order: l.display_order ?? 0
    })),
  };

  const form = useForm<ComposerPayloadType>({ defaultValues, resolver: zodResolver(ComposerPayload), mode: "onChange" });
  const { control, register, watch, setValue, reset } = form;

  const links = useFieldArray({ control, name: "links" });
  const selectedNationalities = watch("nationalities") || [];

  // Create new Draft row on mount for /new
  useEffect(() => {
    if (isNew && !composerId) {
      (async () => {
        const res = await fetch("/api/admin/composers", { method: "POST" });
        if (!res.ok) return;
        const json = await res.json();
        setComposerId(json.id);
        router.replace(`/admin/composers/${json.id}`);
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew]);

  // Autosave (debounced on form values)
  const watched = watch();
  const debounced = useDebounced(watched, 800);

  useEffect(() => {
    if (!composerId) return;

    const doSave = async () => {
      const firstName = debounced.first_name?.trim() || "";
      const lastName = debounced.last_name?.trim() || "";
      
      // Skip save if both names are empty (validation will fail)
      if (!firstName && !lastName) {
        // Don't save yet, but don't show error - user is still typing
        return;
      }

      setSaving("saving");
      const res = await fetch(`/api/admin/composers/${composerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...debounced,
          first_name: firstName,
          last_name: lastName,
          birth_year: debounced.birth_year?.trim() || null,
          death_year: debounced.death_year?.trim() || null,
          gender_self_describe: debounced.gender_self_describe?.trim() || null,
        }),
      });

      if (!res.ok) { 
        const errorData = await res.json().catch(() => ({}));
        setSaving("error");
        // Show validation error if both names are empty
        if (errorData.error?.includes("first_name or last_name")) {
          // Error is already clear from validation
        }
        return; 
      }

      const json = await res.json();
      lastSavedRef.current = json.composer;
      setSaving("saved");
      setTimeout(() => setSaving("idle"), 1200);
    };

    doSave();
  }, [debounced, composerId]);

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
  const selectedGenderId = watch("gender_id");
  const showGenderSelfDescribe = selectedGenderId && genders.find(g => g.id === selectedGenderId)?.label === "Self-Describe";

  const toggleNationality = (iso2: string) => {
    const current = selectedNationalities;
    const updated = current.includes(iso2)
      ? current.filter((c: string) => c !== iso2)
      : [...current, iso2];
    setValue("nationalities", updated);
  };

  const handleDelete = async () => {
    if (!composerId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/composers/${composerId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete composer");
      }
      router.push("/admin/composers");
    } catch (error) {
      console.error("Delete error:", error);
      alert(error instanceof Error ? error.message : "Failed to delete composer");
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{composerId ? "Edit Composer" : "New Composer"}</h1>
          <p className="text-sm text-muted-foreground">
            {saving === "saving" ? "Saving…" : saving === "saved" ? "Saved" : saving === "error" ? "Error saving" : "Autosave ready"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {composerId && (
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
          <Button onClick={() => form.trigger()}>Save</Button>
        </div>
      </div>

      <Separator />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="md:col-span-2 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>First Name</Label>
              <Input placeholder="e.g., Ludwig" {...register("first_name")} />
            </div>
            <div className="space-y-2">
              <Label>Last Name</Label>
              <Input placeholder="e.g., van Beethoven" {...register("last_name")} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Birth Year</Label>
              <Input placeholder="YYYY" {...register("birth_year")} />
            </div>
            <div className="space-y-2">
              <Label>Death Year</Label>
              <Input placeholder="YYYY" {...register("death_year")} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Birth Place</Label>
              <PlaceSelector value={watch("birth_place_id") || undefined} onSelect={(id) => setValue("birth_place_id", id)} />
            </div>
            <div className="space-y-2">
              <Label>Death Place</Label>
              <PlaceSelector value={watch("death_place_id") || undefined} onSelect={(id) => setValue("death_place_id", id)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Gender Identity</Label>
            <Select
              value={watch("gender_id") ?? ""}
              onValueChange={(v) => setValue("gender_id", v || undefined)}
            >
              <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
              <SelectContent>
                {genders.map(g => <SelectItem key={g.id} value={g.id}>{g.label}</SelectItem>)}
              </SelectContent>
            </Select>
            {showGenderSelfDescribe && (
              <Input placeholder="Please describe" {...register("gender_self_describe")} className="mt-2" />
            )}
          </div>

          <div className="space-y-2">
            <Label>Nationalities</Label>
            <div className="border rounded-md p-3 max-h-48 overflow-auto">
              <div className="grid grid-cols-2 gap-2">
                {countries.map(country => (
                  <label key={country.iso2} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedNationalities.includes(country.iso2)}
                      onChange={() => toggleNationality(country.iso2)}
                      className="rounded"
                    />
                    <span className="text-sm">{country.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Links */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Links</Label>
              <Button type="button" variant="secondary" onClick={() => links.append({ url: "", is_primary: false })}>+ Add Link</Button>
            </div>
            <div className="space-y-3">
              {links.fields.map((field, idx) => (
                <div key={field.id} className="grid grid-cols-1 md:grid-cols-8 gap-2">
                  <Input className="md:col-span-5" placeholder="https://…" {...register(`links.${idx}.url` as const)} />
                  <div className="md:col-span-2 flex items-center gap-2">
                    <input
                      type="checkbox"
                      {...register(`links.${idx}.is_primary` as const)}
                      className="rounded"
                    />
                    <Label className="text-xs">Primary</Label>
                  </div>
                  <Button type="button" variant="ghost" onClick={() => links.remove(idx)}>Remove</Button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right column - empty for now, can add related works later */}
        <div className="space-y-6">
          <div className="text-sm text-muted-foreground">
            Related works and other metadata can be added here in future updates.
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
                reset({
                  first_name: lastSavedRef.current.first_name ?? "",
                  last_name: lastSavedRef.current.last_name ?? "",
                  birth_year: lastSavedRef.current.birth_year ? String(lastSavedRef.current.birth_year) : "",
                  death_year: lastSavedRef.current.death_year ? String(lastSavedRef.current.death_year) : "",
                  birth_place_id: lastSavedRef.current.birth_place_id ?? undefined,
                  death_place_id: lastSavedRef.current.death_place_id ?? undefined,
                  gender_id: lastSavedRef.current.gender_id ?? undefined,
                  gender_self_describe: lastSavedRef.current.gender_self_describe ?? "",
                  status: lastSavedRef.current.status ?? "draft",
                  nationalities: [],
                  links: [],
                });
              } else {
                router.push("/admin");
              }
              setShowDiscard(false);
            }}>Discard</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete dialog */}
      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Composer?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this composer? This action cannot be undone. All related works and associations will also be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowDelete(false)} disabled={deleting}>
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

/** Place selector using location search */
function PlaceSelector({ value, onSelect }: { value: string | undefined; onSelect: (id: string | undefined) => void }) {
  return (
    <LocationSearch
      value={value}
      onSelect={onSelect}
      placeholder="Search for a location..."
    />
  );
}

