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

export type ImslpOrchestralClassification =
  | "orchestral"
  | "non_orchestral"
  | "unknown";

export interface ImslpOrchestralAssessment {
  classification: ImslpOrchestralClassification;
  reason: string;
  matchedSignals: string[];
  normalizedInstrumentationText: string | null;
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
const ORCHESTRA_PATTERNS: Array<[string, RegExp]> = [
  ["orchestra", /\borchestra(?:l)?\b/i],
];
const STRING_PATTERNS: Array<[string, RegExp]> = [
  ["strings", /\bstrings?\b/i],
  ["violin", /\bviolins?\b/i],
  ["viola", /\bviolas?\b/i],
  ["cello", /\bcellos?\b/i],
  ["double_bass", /\bdouble bass(?:es)?\b/i],
  ["bass", /\bbass(?:es)?\b/i],
  ["harp", /\bharp\b/i],
];
const WOODWIND_PATTERNS: Array<[string, RegExp]> = [
  ["piccolo", /\bpiccolo\b/i],
  ["flute", /\bflutes?\b/i],
  ["oboe", /\boboes?\b/i],
  ["english_horn", /\benglish horn\b/i],
  ["clarinet", /\bclarinets?\b/i],
  ["bass_clarinet", /\bbass clarinet\b/i],
  ["bassoon", /\bbassoons?\b/i],
  ["contrabassoon", /\bcontrabassoon\b/i],
  ["saxophone", /\bsaxophones?\b/i],
];
const BRASS_PATTERNS: Array<[string, RegExp]> = [
  ["horn", /\bhorns?\b/i],
  ["trumpet", /\btrumpets?\b/i],
  ["trombone", /\btrombones?\b/i],
  ["tuba", /\btuba\b/i],
  ["euphonium", /\beuphonium\b/i],
  ["cornet", /\bcornets?\b/i],
];
const PERCUSSION_PATTERNS: Array<[string, RegExp]> = [
  ["timpani", /\btimpani\b/i],
  ["percussion", /\bpercussion\b/i],
  ["cymbal", /\bcymbal(?:s)?\b/i],
  ["snare_drum", /\bsnare drum\b/i],
  ["bass_drum", /\bbass drum\b/i],
  ["triangle", /\btriangle\b/i],
  ["xylophone", /\bxylophone\b/i],
  ["glockenspiel", /\bglockenspiel\b/i],
  ["marimba", /\bmarimba\b/i],
  ["tam_tam", /\btam-?tam\b/i],
];

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeInstrumentationText(value: string): string {
  return normalizeText(
    value
      .replace(/<br\s*\/?>/gi, "; ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/\{\{[^}]+\}\}/g, " ")
      .replace(/\[\[[^\]]+\]\]/g, " ")
      .replace(/\|/g, " ")
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'"),
  );
}

function collectSignalNames(
  value: string,
  patterns: Array<[string, RegExp]>,
): string[] {
  return patterns
    .filter(([, pattern]) => pattern.test(value))
    .map(([name]) => name);
}

export function assessImslpWorkOrchestralScope(
  instrumentationText: string | null | undefined,
): ImslpOrchestralAssessment {
  if (!instrumentationText?.trim()) {
    return {
      classification: "unknown",
      reason: "missing_instrumentation_text",
      matchedSignals: [],
      normalizedInstrumentationText: null,
    };
  }

  const normalized = normalizeInstrumentationText(instrumentationText);
  if (!normalized) {
    return {
      classification: "unknown",
      reason: "missing_instrumentation_text",
      matchedSignals: [],
      normalizedInstrumentationText: null,
    };
  }

  const orchestraSignals = collectSignalNames(normalized, ORCHESTRA_PATTERNS);
  if (orchestraSignals.length > 0) {
    return {
      classification: "orchestral",
      reason: "explicit_orchestra_signal",
      matchedSignals: orchestraSignals,
      normalizedInstrumentationText: normalized,
    };
  }

  const stringSignals = collectSignalNames(
    normalized,
    STRING_PATTERNS,
  );
  const woodwindSignals = collectSignalNames(
    normalized,
    WOODWIND_PATTERNS,
  );
  const brassSignals = collectSignalNames(
    normalized,
    BRASS_PATTERNS,
  );
  const percussionSignals = collectSignalNames(
    normalized,
    PERCUSSION_PATTERNS,
  );

  const orchestralFamilyCount = [
    stringSignals.length > 0,
    woodwindSignals.length > 0,
    brassSignals.length > 0,
    percussionSignals.length > 0,
  ].filter(Boolean).length;

  const matchedSignals = [
    ...stringSignals,
    ...woodwindSignals,
    ...brassSignals,
    ...percussionSignals,
  ];

  if (
    stringSignals.length >= 3 &&
    matchedSignals.length >= 6 &&
    orchestralFamilyCount >= 3
  ) {
    return {
      classification: "orchestral",
      reason: "multi_family_orchestral_scoring",
      matchedSignals,
      normalizedInstrumentationText: normalized,
    };
  }

  return {
    classification: "non_orchestral",
    reason: "instrumentation_lacks_orchestral_signals",
    matchedSignals,
    normalizedInstrumentationText: normalized,
  };
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

  const approximatePrefixMatch =
    /^(?:ca\.?|circa|approx\.?|approximately)\s*(\d+(?:\.\d+)?)\s+(minutes?|mins?|min|seconds?|secs?|sec|hours?|hrs?|hr)\b/i.exec(
      value,
    );
  if (approximatePrefixMatch?.[1] && approximatePrefixMatch[2]) {
    return `${approximatePrefixMatch[1]} ${approximatePrefixMatch[2]}`;
  }

  const eachMatch = /^(\d+(?:\.\d+)?)\s+(minutes?|mins?|min|seconds?|secs?|sec|hours?|hrs?|hr)\s+each$/i.exec(
    value,
  );
  if (eachMatch?.[1] && eachMatch[2]) {
    return `${eachMatch[1]} ${eachMatch[2]}`;
  }

  const underDurationMatch =
    /^(?:each\s+.+?\s+is\s+)?under\s+(\d+(?:\.\d+)?)\s+(minutes?|mins?|min|seconds?|secs?|sec|hours?|hrs?|hr)(?:\s+in\s+length)?$/i.exec(
      value,
    );
  if (underDurationMatch?.[1] && underDurationMatch[2]) {
    return `${underDurationMatch[1]} ${underDurationMatch[2]}`;
  }

  const leadingDurationMatch =
    /^(\d+(?:\.\d+)?(?:\s*-\s*\d+(?:\.\d+)?)?)\s+(minutes?|mins?|min|seconds?|secs?|sec|hours?|hrs?|hr)\b(?:\s*ca\.?)?/i.exec(
      value,
    );
  if (leadingDurationMatch?.[1] && leadingDurationMatch[2]) {
    return `${leadingDurationMatch[1].replace(/\s*-\s*/g, "-")} ${leadingDurationMatch[2]}`;
  }

  // IMSLP work pages sometimes store average duration as a bare numeral.
  // Treat that source-specific shorthand as minutes without changing the
  // preserved raw field text.
  if (/^\d+(?:\.\d+)?$/.test(value)) {
    return `${value} minutes`;
  }

  // IMSLP occasionally leaks non-duration prose into Average Duration.
  // If there is no numeric signal at all, preserve the raw field text in
  // metadata but do not promote it into normalized duration parsing.
  if (!/\d/.test(value)) {
    return null;
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
