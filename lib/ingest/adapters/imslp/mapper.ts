import type { ComposerCandidate, SourceIdentity } from "@/lib/ingest/candidates";
import type { JsonObject } from "@/lib/ingest/domain";
import type {
  ImslpType1ParsedRow,
  ImslpPersonClassification,
} from "@/lib/ingest/adapters/imslp/parser";

export interface ImslpComposerMapResult {
  candidate: ComposerCandidate | null;
  classification: ImslpPersonClassification;
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
