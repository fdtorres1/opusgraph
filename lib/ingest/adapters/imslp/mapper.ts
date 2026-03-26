import type {
  CandidateWarning,
  ComposerCandidate,
  SourceIdentity,
  WorkCandidate,
} from "@/lib/ingest/candidates";
import type { IngestIssue, JsonObject } from "@/lib/ingest/domain";
import type { ImslpWorkPageRecord } from "@/lib/ingest/adapters/imslp/page-client";
import type { ImslpWorkFieldExtraction } from "@/lib/ingest/adapters/imslp/work-fields";
import type {
  ImslpType1ParsedRow,
  ImslpType2ParsedRow,
  ImslpPersonClassification,
} from "@/lib/ingest/adapters/imslp/parser";
import { IMSLP_API_ORIGIN } from "./constants";

export interface ImslpComposerMapResult {
  candidate: ComposerCandidate | null;
  classification: ImslpPersonClassification;
}

export interface ImslpWorkMapResult {
  candidate: WorkCandidate | null;
  issues: IngestIssue[];
}

function buildImslpExternalIds(row: ImslpType1ParsedRow): JsonObject {
  return {
    source_entity_kind: row.sourceEntityKind,
    canonical_title: row.canonicalTitle,
    canonical_url: row.canonicalUrl,
    list_type: row.listType,
    list_id: row.listId,
    parent_category: row.parentCategory,
  };
}

function buildSourceIdentity(row: ImslpType1ParsedRow): SourceIdentity {
  return {
    source: row.source,
    sourceEntityKind: row.sourceEntityKind,
    sourceId: row.canonicalTitle,
    sourceUrl: row.canonicalUrl,
    canonicalTitle: row.canonicalTitle,
    externalIds: buildImslpExternalIds(row),
  };
}

function buildExtraMetadata(row: ImslpType1ParsedRow): JsonObject {
  return {
    source_entity_kind: row.sourceEntityKind,
    canonical_title: row.canonicalTitle,
    canonical_url: row.canonicalUrl,
    list_type: row.listType,
    list_id: row.listId,
    parent_category: row.parentCategory,
    classification: row.classification,
    classification_reason: row.classificationReason,
    canonical_name: {
      display_name: row.canonicalName.displayName,
      first_name: row.canonicalName.firstName,
      last_name: row.canonicalName.lastName,
      is_mononym: row.canonicalName.isMononym,
      has_comma: row.canonicalName.hasComma,
    },
    intvals: row.intvals,
  };
}

export function mapImslpComposerCandidate(
  row: ImslpType1ParsedRow,
): ComposerCandidate | null {
  if (row.classification !== "composer") {
    return null;
  }

  const firstName = row.canonicalName.firstName;
  const lastName = row.canonicalName.lastName;

  return {
    entityKind: "composer",
    sourceIdentity: buildSourceIdentity(row),
    rawPayload: row.rawPayload,
    warnings: row.warnings,
    extraMetadata: buildExtraMetadata(row),
    displayName: row.canonicalName.displayName,
    firstName,
    lastName,
  };
}

export function mapImslpComposerCandidates(
  rows: ImslpType1ParsedRow[],
): ComposerCandidate[] {
  return rows
    .map((row) => mapImslpComposerCandidate(row))
    .filter((candidate): candidate is ComposerCandidate => candidate !== null);
}

function issue(
  code: string,
  message: string,
  severity: IngestIssue["severity"] = "warning",
  metadata?: JsonObject,
): IngestIssue {
  return {
    code,
    message,
    severity,
    ...(metadata ? { metadata } : {}),
  };
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function buildImslpPageUrl(title: string): string {
  const normalizedTitle = title.trim().replace(/\s+/g, "_");
  return new URL(`/wiki/${encodeURIComponent(normalizedTitle)}`, IMSLP_API_ORIGIN).toString();
}

function parseCompositionYear(
  value: string | null,
): { compositionYear: number | null; issues: IngestIssue[] } {
  if (!value) {
    return { compositionYear: null, issues: [] };
  }

  const matches = Array.from(
    value.matchAll(/\b(1[0-9]{3}|20[0-9]{2})\b/g),
    (match) => Number(match[1]),
  );
  const uniqueYears = Array.from(new Set(matches));

  if (uniqueYears.length === 1) {
    return { compositionYear: uniqueYears[0], issues: [] };
  }

  if (uniqueYears.length > 1) {
    return {
      compositionYear: null,
      issues: [
        issue(
          "imslp_work_ambiguous_composition_year",
          "IMSLP work composition year text contained multiple distinct years.",
          "warning",
          { compositionYearText: value, years: uniqueYears },
        ),
      ],
    };
  }

  return {
    compositionYear: null,
    issues: [
      issue(
        "imslp_work_unparsed_composition_year",
        "IMSLP work composition year text could not be normalized to a numeric year.",
        "warning",
        { compositionYearText: value },
      ),
    ],
  };
}

function parseOpusCatalogue(
  value: string | null,
): { opusNumber: string | null; catalogNumber: string | null } {
  if (!value) {
    return { opusNumber: null, catalogNumber: null };
  }

  const normalized = normalizeWhitespace(value);
  if (/\bop(?:us)?\.?\b/i.test(normalized)) {
    return { opusNumber: normalized, catalogNumber: null };
  }

  return { opusNumber: null, catalogNumber: normalized };
}

function parseMovements(
  value: string | null,
): { movements: string[] | null; issues: IngestIssue[] } {
  if (!value) {
    return { movements: null, issues: [] };
  }

  const semicolonParts = value
    .split(/\s*;\s*/g)
    .map((part) => normalizeWhitespace(part))
    .filter((part) => part.length > 0);
  if (semicolonParts.length > 1) {
    return { movements: semicolonParts, issues: [] };
  }

  const numberedParts = value
    .split(/\s+(?=\d+\.\s*)/g)
    .map((part) => normalizeWhitespace(part))
    .filter((part) => part.length > 0);
  if (numberedParts.length > 1) {
    return { movements: numberedParts, issues: [] };
  }

  return {
    movements: null,
    issues: [
      issue(
        "imslp_work_unparsed_movements",
        "IMSLP work movement text was preserved as raw metadata because it could not be split reliably.",
        "warning",
        { movementText: value },
      ),
    ],
  };
}

function buildImslpWorkExternalIds(
  row: ImslpType2ParsedRow,
  page: ImslpWorkPageRecord,
): JsonObject {
  return {
    source_entity_kind: row.sourceEntityKind,
    canonical_title: page.metadata.title || row.canonicalTitle,
    canonical_url: buildImslpPageUrl(page.metadata.title || row.canonicalTitle),
    list_type: row.listType,
    list_id: row.listId,
    parent_category: row.parentCategory,
    page_id: page.metadata.pageId > 0 ? String(page.metadata.pageId) : row.pageId,
  };
}

function buildImslpWorkSourceIdentity(
  row: ImslpType2ParsedRow,
  page: ImslpWorkPageRecord,
): SourceIdentity {
  const canonicalTitle = page.metadata.title || row.canonicalTitle;
  const canonicalUrl = buildImslpPageUrl(canonicalTitle);

  return {
    source: row.source,
    sourceEntityKind: row.sourceEntityKind,
    sourceId: canonicalTitle,
    sourceUrl: canonicalUrl,
    canonicalTitle,
    externalIds: buildImslpWorkExternalIds(row, page),
  };
}

function buildImslpWorkWarnings(
  issues: IngestIssue[],
): CandidateWarning[] {
  return issues.filter(
    (item): item is CandidateWarning =>
      item.severity === "warning" || item.severity === "error",
  );
}

export function mapImslpWorkCandidate(args: {
  row: ImslpType2ParsedRow;
  page: ImslpWorkPageRecord;
  fields: ImslpWorkFieldExtraction;
}): ImslpWorkMapResult {
  const { row, page, fields } = args;
  const issues: IngestIssue[] = [...page.issues];

  const sourceIdentity = buildImslpWorkSourceIdentity(row, page);
  const { compositionYear, issues: yearIssues } = parseCompositionYear(
    fields.compositionYearText,
  );
  const { opusNumber, catalogNumber } = parseOpusCatalogue(
    fields.opusCatalogueText ?? row.catalogNumber,
  );
  const { movements, issues: movementIssues } = parseMovements(fields.movementText);

  issues.push(...yearIssues, ...movementIssues);

  const title = normalizeWhitespace(
    fields.title ??
      fields.alternativeTitle ??
      page.metadata.displayTitle ??
      sourceIdentity.canonicalTitle ??
      row.workTitle ??
      row.canonicalTitle,
  );

  if (!title) {
    issues.push(
      issue(
        "imslp_work_missing_title",
        "IMSLP work row could not be mapped because no title was available after page normalization.",
        "error",
        { listId: row.listId, pageTitle: page.metadata.title },
      ),
    );

    return { candidate: null, issues };
  }

  const candidate: WorkCandidate = {
    entityKind: "work",
    sourceIdentity,
    rawPayload: row.rawPayload,
    warnings: buildImslpWorkWarnings(issues),
    extraMetadata: {
      source_entity_kind: row.sourceEntityKind,
      canonical_title: sourceIdentity.canonicalTitle ?? null,
      canonical_url: sourceIdentity.sourceUrl ?? null,
      list_type: row.listType,
      list_id: row.listId,
      parent_category: row.parentCategory,
      composer_name: row.composerName,
      work_title: row.workTitle,
      catalog_number: row.catalogNumber,
      page_id: row.pageId,
      page: {
        page_id: page.metadata.pageId,
        title: page.metadata.title,
        display_title: page.metadata.displayTitle,
        redirect_title: page.metadata.redirectTitle,
        normalized_title: page.metadata.normalizedTitle,
        touched: page.metadata.touched,
        last_revid: page.metadata.lastRevid,
        length: page.metadata.length,
      },
      extracted_fields: {
        title: fields.title,
        alternative_title: fields.alternativeTitle,
        opus_catalogue_text: fields.opusCatalogueText,
        composition_year_text: fields.compositionYearText,
        instrumentation_text: fields.instrumentationText,
        movement_text: fields.movementText,
        duration_text: fields.durationText,
        raw_fields: fields.rawFields,
      },
    },
    title,
    composerSourceId: row.parentCategory ?? row.composerName ?? undefined,
    composerDisplayName: row.parentCategory ?? row.composerName ?? undefined,
    compositionYear,
    instrumentationText: fields.instrumentationText,
    opusNumber,
    catalogNumber,
    movements: movements ?? undefined,
    durationText: fields.durationText,
    sources: sourceIdentity.sourceUrl ? [sourceIdentity.sourceUrl] : undefined,
  };

  return { candidate, issues };
}
