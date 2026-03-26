import type { JsonObject } from "@/lib/ingest/domain";

export interface ImslpWorkFieldExtraction {
  title: string | null;
  alternativeTitle: string | null;
  opusCatalogueText: string | null;
  compositionYearText: string | null;
  instrumentationText: string | null;
  movementText: string | null;
  durationText: string | null;
  rawFields: JsonObject;
}

const WORK_INFO_START_MARKER = "*****WORK INFO*****";
const WORK_INFO_END_MARKERS = ["*****COMMENTS*****", "*****END OF TEMPLATE*****"];

const WORK_TITLE_KEYS = ["Work Title"];
const ALTERNATIVE_TITLE_KEYS = ["Alternative Title"];
const OPUS_CATALOGUE_KEYS = ["Opus/Catalogue Number"];
const COMPOSITION_YEAR_KEYS = ["Year/Date of Composition"];
const INSTRUMENTATION_KEYS = ["Instrumentation"];
const MOVEMENT_KEYS = [
  "Movements",
  "Movements Header",
  "Number of Movements/Sections",
  "Movement",
  "Movement(s)",
];
const DURATION_KEYS = ["Average Duration"];

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function extractWorkInfoBlock(wikitext: string): string {
  const lower = wikitext.toLowerCase();
  const startIndex = lower.indexOf(WORK_INFO_START_MARKER.toLowerCase());
  if (startIndex < 0) {
    return "";
  }

  const blockStart = wikitext.indexOf("\n", startIndex);
  const bodyStart = blockStart >= 0 ? blockStart + 1 : startIndex + WORK_INFO_START_MARKER.length;
  const tail = wikitext.slice(bodyStart);

  let endIndex = tail.length;
  for (const marker of WORK_INFO_END_MARKERS) {
    const markerIndex = tail.toLowerCase().indexOf(marker.toLowerCase());
    if (markerIndex >= 0 && markerIndex < endIndex) {
      endIndex = markerIndex;
    }
  }

  return tail.slice(0, endIndex);
}

function parseWorkInfoFields(block: string): JsonObject {
  const fields: JsonObject = {};

  for (const line of block.split(/\r?\n/)) {
    const match = /^\s*\|([^=]+?)=(.*)$/.exec(line);
    if (!match) {
      continue;
    }

    const key = normalizeText(match[1] ?? "");
    if (!key) {
      continue;
    }

    const value = normalizeText(match[2] ?? "");
    fields[key] = value;
  }

  return fields;
}

function pickFirstField(fields: JsonObject, keys: string[]): string | null {
  for (const key of keys) {
    const value = fields[key];
    if (typeof value === "string") {
      const normalized = normalizeText(value);
      if (normalized.length > 0) {
        return normalized;
      }
    }
  }

  return null;
}

function toWorkFieldValue(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = normalizeText(value);
  return normalized.length > 0 ? normalized : null;
}

function normalizeImslpDurationText(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const eachMatch = /^(\d+(?:\.\d+)?)\s+(minutes?|mins?|min|seconds?|secs?|sec|hours?|hrs?|hr)\s+each$/i.exec(
    value,
  );
  if (eachMatch?.[1] && eachMatch[2]) {
    return `${eachMatch[1]} ${eachMatch[2]}`;
  }

  // IMSLP work pages sometimes store average duration as a bare numeral.
  // Treat that source-specific shorthand as minutes without changing the
  // preserved raw field text.
  if (/^\d+(?:\.\d+)?$/.test(value)) {
    return `${value} minutes`;
  }

  return value;
}

export function extractImslpWorkFields(
  wikitext: string,
  fallbackTitle?: string | null,
): ImslpWorkFieldExtraction {
  const block = extractWorkInfoBlock(wikitext);
  const rawFields = parseWorkInfoFields(block);

  return {
    title:
      pickFirstField(rawFields, WORK_TITLE_KEYS) ??
      toWorkFieldValue(fallbackTitle ?? null),
    alternativeTitle: pickFirstField(rawFields, ALTERNATIVE_TITLE_KEYS),
    opusCatalogueText: pickFirstField(rawFields, OPUS_CATALOGUE_KEYS),
    compositionYearText: pickFirstField(rawFields, COMPOSITION_YEAR_KEYS),
    instrumentationText: pickFirstField(rawFields, INSTRUMENTATION_KEYS),
    movementText: pickFirstField(rawFields, MOVEMENT_KEYS),
    durationText: normalizeImslpDurationText(
      pickFirstField(rawFields, DURATION_KEYS),
    ),
    rawFields,
  };
}
