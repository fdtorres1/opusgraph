import type { CandidateWarning } from "@/lib/ingest/candidates";
import type { JsonObject, JsonValue } from "@/lib/ingest/domain";

export type ImslpSourceEntityKind = "person" | "work";
export type ImslpPersonClassification = "composer" | "person";

export interface ImslpType1ApiRow {
  id?: unknown;
  type?: unknown;
  parent?: unknown;
  intvals?: unknown;
  permlink?: unknown;
}

export interface ImslpCanonicalName {
  displayName: string;
  firstName: string;
  lastName: string;
  isMononym: boolean;
  hasComma: boolean;
}

export interface ImslpType1ParsedRow {
  source: "imslp";
  sourceEntityKind: ImslpSourceEntityKind;
  listType: 1;
  listId: string;
  canonicalTitle: string;
  canonicalUrl: string;
  parentCategory: string | null;
  intvals: JsonValue[];
  canonicalName: ImslpCanonicalName;
  classification: ImslpPersonClassification;
  classificationReason: string;
  warnings: CandidateWarning[];
  rawPayload: JsonObject;
}

export interface ImslpType2ApiRow {
  id?: unknown;
  type?: unknown;
  parent?: unknown;
  intvals?: unknown;
  permlink?: unknown;
}

export interface ImslpType2ParsedRow {
  source: "imslp";
  sourceEntityKind: ImslpSourceEntityKind;
  listType: 2;
  listId: string;
  canonicalTitle: string;
  canonicalUrl: string;
  parentCategory: string | null;
  composerName: string | null;
  workTitle: string | null;
  catalogNumber: string | null;
  pageId: string | null;
  intvals: JsonObject;
  rawPayload: JsonObject;
}

const COMPOSER_NEGATION_KEYWORDS = [
  "editor",
  "editors",
  "performer",
  "performers",
  "arranger",
  "arrangers",
  "publisher",
  "publishers",
  "conservatorio",
  "conservatory",
  "conservatoire",
  "orchestra",
  "orchestral",
  "choir",
  "choral",
  "ensemble",
  "quartet",
  "trio",
  "duo",
  "society",
  "library",
  "school",
  "university",
  "academy",
  "institute",
  "band",
  "recording",
  "commercial",
  "catalog",
];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toTrimmedString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function stripCategoryPrefix(value: string): string {
  return value.replace(/^Category:\s*/i, "");
}

function normalizeImslpUrl(value: string): string {
  try {
    return new URL(value).toString();
  } catch {
    return normalizeWhitespace(value);
  }
}

function sanitizeJsonValue(value: unknown): JsonValue | undefined {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "number" ||
    typeof value === "string"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    const sanitized = value
      .map((item) => sanitizeJsonValue(item))
      .filter((item): item is JsonValue => item !== undefined);
    return sanitized;
  }

  if (isPlainObject(value)) {
    const result: JsonObject = {};
    for (const [key, item] of Object.entries(value)) {
      const sanitized = sanitizeJsonValue(item);
      if (sanitized !== undefined) {
        result[key] = sanitized;
      }
    }
    return result;
  }

  return undefined;
}

function parseIntvalsObject(value: unknown): JsonObject {
  if (!isPlainObject(value)) {
    return {};
  }

  const result: JsonObject = {};
  for (const [key, item] of Object.entries(value)) {
    const sanitized = sanitizeJsonValue(item);
    if (sanitized !== undefined) {
      result[key] = sanitized;
    }
  }

  return result;
}

function parseIntvals(value: unknown): JsonValue[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => sanitizeJsonValue(item))
    .filter((item): item is JsonValue => item !== undefined);
}

function hasAlphabeticText(value: string): boolean {
  return /[\p{L}]/u.test(value);
}

function countLetters(value: string): number {
  return Array.from(value).filter((char) => /\p{L}/u.test(char)).length;
}

function hasDigits(value: string): boolean {
  return /\d/.test(value);
}

function startsWithNameCharacter(value: string): boolean {
  return /^[\p{L}'’]/u.test(value);
}

function hasComposerNegation(value: string): boolean {
  const tokens = value
    .toLowerCase()
    .split(/[^\p{L}]+/u)
    .filter((token) => token.length > 0);

  return COMPOSER_NEGATION_KEYWORDS.some((keyword) => tokens.includes(keyword));
}

export function parseImslpCanonicalName(value: string): ImslpCanonicalName {
  const normalized = normalizeWhitespace(stripCategoryPrefix(value));
  const segments = normalized
    .split(",")
    .map((segment) => normalizeWhitespace(segment))
    .filter((segment) => segment.length > 0);

  if (segments.length >= 2) {
    const lastName = segments[0];
    const firstName = segments.slice(1).join(", ");
    return {
      displayName: `${lastName}, ${firstName}`,
      firstName,
      lastName,
      isMononym: false,
      hasComma: true,
    };
  }

  const displayName = normalized;
  const tokenCount = normalized.length > 0 ? normalized.split(" ").length : 0;

  return {
    displayName,
    firstName: "",
    lastName: displayName,
    isMononym: tokenCount <= 1,
    hasComma: false,
  };
}

export function classifyImslpType1Row(
  listId: string,
  canonicalName: ImslpCanonicalName,
): {
  classification: ImslpPersonClassification;
  reason: string;
  warnings: CandidateWarning[];
} {
  const warnings: CandidateWarning[] = [];

  if (!canonicalName.hasComma) {
    warnings.push({
      code: "imslp_type1_unusual_name_format",
      message:
        "IMSLP type=1 row did not use a comma-separated personal name format.",
      severity: "warning",
      metadata: { list_id: listId },
    });
    return {
      classification: "person",
      reason: "name_not_comma_form",
      warnings,
    };
  }

  if (!hasAlphabeticText(listId) || hasComposerNegation(listId)) {
    warnings.push({
      code: "imslp_type1_non_composer_row",
      message:
        "IMSLP type=1 row looks like a non-composer person/category record.",
      severity: "warning",
      metadata: { list_id: listId },
    });
    return {
      classification: "person",
      reason: "non_composer_keyword",
      warnings,
    };
  }

  if (
    !hasAlphabeticText(canonicalName.firstName) ||
    !hasAlphabeticText(canonicalName.lastName) ||
    hasDigits(canonicalName.firstName) ||
    hasDigits(canonicalName.lastName) ||
    countLetters(canonicalName.firstName) < 2 ||
    countLetters(canonicalName.lastName) < 2 ||
    !startsWithNameCharacter(canonicalName.firstName) ||
    !startsWithNameCharacter(canonicalName.lastName)
  ) {
    warnings.push({
      code: "imslp_type1_invalid_name_parts",
      message:
        "IMSLP type=1 row has name parts that do not look like a composer name.",
      severity: "warning",
      metadata: { list_id: listId },
    });
    return {
      classification: "person",
      reason: "invalid_name_parts",
      warnings,
    };
  }

  return {
    classification: "composer",
    reason: "comma_form_name_without_non_composer_keyword",
    warnings,
  };
}

export function parseImslpType1Row(
  value: unknown,
): ImslpType1ParsedRow | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const type = toTrimmedString(value.type);
  if (type !== "1") {
    return null;
  }

  const rawId = toTrimmedString(value.id);
  const rawPermlink = toTrimmedString(value.permlink);
  if (!rawId || !rawPermlink) {
    return null;
  }

  const listId = stripCategoryPrefix(rawId);
  const canonicalTitle = normalizeWhitespace(listId);
  const canonicalUrl = normalizeImslpUrl(rawPermlink);
  const parentCategory = toTrimmedString(value.parent);
  const intvals = parseIntvals(value.intvals);
  const canonicalName = parseImslpCanonicalName(listId);
  const classification = classifyImslpType1Row(canonicalTitle, canonicalName);

  const rawPayload: JsonObject = {
    source: "imslp",
    source_entity_kind: "person",
    list_type: 1,
    list_id: listId,
    canonical_title: canonicalTitle,
    canonical_url: canonicalUrl,
    parent_category: parentCategory,
    intvals,
    canonical_name: {
      display_name: canonicalName.displayName,
      first_name: canonicalName.firstName,
      last_name: canonicalName.lastName,
      is_mononym: canonicalName.isMononym,
      has_comma: canonicalName.hasComma,
    },
    classification: classification.classification,
    classification_reason: classification.reason,
    raw: {
      id: rawId,
      type: 1,
      parent: parentCategory,
      intvals,
      permlink: rawPermlink,
    },
  };

  return {
    source: "imslp",
    sourceEntityKind: "person",
    listType: 1,
    listId: canonicalTitle,
    canonicalTitle,
    canonicalUrl,
    parentCategory,
    intvals,
    canonicalName,
    classification: classification.classification,
    classificationReason: classification.reason,
    warnings: classification.warnings,
    rawPayload,
  };
}

export function parseImslpType1Batch(
  value: unknown,
): ImslpType1ParsedRow[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => parseImslpType1Row(item))
      .filter((item): item is ImslpType1ParsedRow => item !== null);
  }

  if (!isPlainObject(value)) {
    return [];
  }

  const entries = Object.entries(value).sort(([left], [right]) => {
    const leftIndex = Number(left);
    const rightIndex = Number(right);

    if (Number.isFinite(leftIndex) && Number.isFinite(rightIndex)) {
      return leftIndex - rightIndex;
    }

    return left.localeCompare(right);
  });

  return entries
    .map(([, item]) => parseImslpType1Row(item))
    .filter((item): item is ImslpType1ParsedRow => item !== null);
}

export function parseImslpType2Row(
  value: unknown,
): ImslpType2ParsedRow | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const type = toTrimmedString(value.type);
  if (type !== "2") {
    return null;
  }

  const rawId = toTrimmedString(value.id);
  const rawPermlink = toTrimmedString(value.permlink);
  if (!rawId || !rawPermlink) {
    return null;
  }

  const rawParentCategory = toTrimmedString(value.parent);
  const listId = normalizeWhitespace(stripCategoryPrefix(rawId));
  const canonicalUrl = normalizeImslpUrl(rawPermlink);
  const intvals = parseIntvalsObject(value.intvals);
  const composerName = toTrimmedString(intvals.composer);
  const workTitle = toTrimmedString(intvals.worktitle);
  const catalogNumber = toTrimmedString(intvals.icatno);
  const pageId = toTrimmedString(intvals.pageid);
  const canonicalTitle = workTitle ?? listId;
  const parentCategory = rawParentCategory
    ? normalizeWhitespace(stripCategoryPrefix(rawParentCategory))
    : null;

  const rawPayload: JsonObject = {
    source: "imslp",
    source_entity_kind: "work",
    list_type: 2,
    list_id: listId,
    canonical_title: canonicalTitle,
    canonical_url: canonicalUrl,
    parent_category: parentCategory,
    composer_name: composerName,
    work_title: workTitle,
    catalog_number: catalogNumber,
    page_id: pageId,
    intvals,
    raw: {
      id: rawId,
      type: 2,
      parent: rawParentCategory,
      intvals,
      permlink: rawPermlink,
    },
  };

  return {
    source: "imslp",
    sourceEntityKind: "work",
    listType: 2,
    listId,
    canonicalTitle,
    canonicalUrl,
    parentCategory,
    composerName,
    workTitle,
    catalogNumber,
    pageId,
    intvals,
    rawPayload,
  };
}

export function parseImslpType2Batch(
  value: unknown,
): ImslpType2ParsedRow[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => parseImslpType2Row(item))
      .filter((item): item is ImslpType2ParsedRow => item !== null);
  }

  if (!isPlainObject(value)) {
    return [];
  }

  const entries = Object.entries(value).sort(([left], [right]) => {
    const leftIndex = Number(left);
    const rightIndex = Number(right);

    if (Number.isFinite(leftIndex) && Number.isFinite(rightIndex)) {
      return leftIndex - rightIndex;
    }

    return left.localeCompare(right);
  });

  return entries
    .map(([, item]) => parseImslpType2Row(item))
    .filter((item): item is ImslpType2ParsedRow => item !== null);
}
