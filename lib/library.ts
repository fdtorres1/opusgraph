// lib/library.ts — Display logic utilities for library entries

// ---------------------------------------------------------------------------
// Types matching Supabase query results
// ---------------------------------------------------------------------------

export interface LibraryEntryRow {
  overrides: {
    title?: string;
    composer_first_name?: string;
    composer_last_name?: string;
    arranger?: string;
    publisher?: string;
    instrumentation?: string;
    duration?: number;
    year_composed?: number;
  } | null;
}

export interface ReferenceWork {
  work_name: string | null;
  instrumentation_text: string | null;
  duration_seconds: number | null;
  composition_year: number | null;
}

export interface ReferenceComposer {
  first_name: string | null;
  last_name: string | null;
}

export interface ReferencePublisher {
  name: string | null;
}

export interface ResolvedEntryDisplay {
  title: string;
  composerFirstName: string;
  composerLastName: string;
  composerDisplayName: string;  // "First Last"
  composerSortName: string;    // "Last, First"
  arranger: string;
  publisher: string;
  instrumentation: string;
  duration: number | null;      // seconds
  yearComposed: number | null;
}

// ---------------------------------------------------------------------------
// Override-merge display resolver
// ---------------------------------------------------------------------------

/**
 * Merges library entry overrides with reference work data.
 * Override values take precedence over reference values.
 * When reference_work_id is null, only overrides are used.
 */
export function resolveEntryDisplay(
  entry: LibraryEntryRow,
  work?: ReferenceWork | null,
  composer?: ReferenceComposer | null,
  publisher?: ReferencePublisher | null,
): ResolvedEntryDisplay {
  const o = entry.overrides ?? {};

  const composerFirstName = o.composer_first_name ?? composer?.first_name ?? "";
  const composerLastName = o.composer_last_name ?? composer?.last_name ?? "";

  return {
    title: o.title ?? work?.work_name ?? "",
    composerFirstName,
    composerLastName,
    composerDisplayName: [composerFirstName, composerLastName].filter(Boolean).join(" "),
    composerSortName: [composerLastName, composerFirstName].filter(Boolean).join(", "),
    arranger: o.arranger ?? "",
    publisher: o.publisher ?? publisher?.name ?? "",
    instrumentation: o.instrumentation ?? work?.instrumentation_text ?? "",
    duration: o.duration ?? work?.duration_seconds ?? null,
    yearComposed: o.year_composed ?? work?.composition_year ?? null,
  };
}

// ---------------------------------------------------------------------------
// Condition helpers
// ---------------------------------------------------------------------------

export const conditionOptions = [
  { value: "excellent", label: "Excellent" },
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
  { value: "poor", label: "Poor" },
  { value: "missing", label: "Missing" },
] as const;

export type ConditionValue = typeof conditionOptions[number]["value"];

/**
 * Returns a human-readable label for a condition value.
 */
export function conditionLabel(condition: string | null | undefined): string {
  if (!condition) return "";
  const option = conditionOptions.find(o => o.value === condition);
  return option?.label ?? condition;
}
