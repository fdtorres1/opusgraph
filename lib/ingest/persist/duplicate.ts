import type {
  ComposerCandidate,
  IngestCandidate,
  WorkCandidate,
} from "@/lib/ingest/candidates";
import type { IngestIssue, JsonObject } from "@/lib/ingest/domain";

export type DuplicateMatchBy = "source_identity" | "fuzzy" | "none";

export interface ComposerDuplicateLookup {
  in_first: string;
  in_last: string;
  in_birth_year?: number | null;
}

export interface WorkDuplicateLookup {
  in_composer_id: string;
  in_work_name: string;
}

export interface DuplicateLookupCallbacks {
  resolveSourceMatchEntityId?: (
    candidate: IngestCandidate,
  ) => string | null | Promise<string | null>;
  findDuplicateComposers?: (
    input: ComposerDuplicateLookup,
  ) => string[] | null | undefined | Promise<string[] | null | undefined>;
  findDuplicateWorks?: (
    input: WorkDuplicateLookup,
  ) => string[] | null | undefined | Promise<string[] | null | undefined>;
}

export type DuplicateReviewFlagDetails = JsonObject & {
  import_source: string;
  source: string;
  source_identity: JsonObject;
  candidate_preview: JsonObject;
  duplicate_ids: string[];
  matched_by: Exclude<DuplicateMatchBy, "none">;
};

export interface DuplicateAssessmentInput<TCandidate extends IngestCandidate> {
  candidate: TCandidate;
  importSource?: string;
  sourceLabel?: string;
  resolvedComposerId?: string | null;
  callbacks?: DuplicateLookupCallbacks;
}

export interface DuplicateAssessmentResult<TCandidate extends IngestCandidate = IngestCandidate> {
  candidate: TCandidate;
  sourceMatchEntityId: string | null;
  duplicateEntityIds: string[];
  shouldFlagDuplicate: boolean;
  matchedBy: DuplicateMatchBy;
  issues: IngestIssue[];
  reviewFlagDetails?: DuplicateReviewFlagDetails;
}

function buildComposerPreview(candidate: ComposerCandidate): JsonObject {
  return {
    display_name: candidate.displayName,
    first_name: candidate.firstName,
    last_name: candidate.lastName,
    birth_year: candidate.birthYear ?? null,
    death_year: candidate.deathYear ?? null,
    gender_id: candidate.genderId ?? null,
    nationality_codes: candidate.nationalityCodes ?? [],
    links: candidate.links ?? [],
  };
}

function buildWorkPreview(candidate: WorkCandidate): JsonObject {
  return {
    title: candidate.title,
    composer_source_id: candidate.composerSourceId ?? null,
    composer_display_name: candidate.composerDisplayName ?? null,
    composition_year: candidate.compositionYear ?? null,
    instrumentation_text: candidate.instrumentationText ?? null,
    opus_number: candidate.opusNumber ?? null,
    catalog_number: candidate.catalogNumber ?? null,
    movements: candidate.movements ?? [],
    duration_text: candidate.durationText ?? null,
    publisher: candidate.publisher ?? null,
    sources: candidate.sources ?? [],
    recordings: candidate.recordings ?? [],
  };
}

export function buildDuplicateReviewFlagDetails(
  candidate: IngestCandidate,
  duplicateIds: string[],
  matchedBy: Exclude<DuplicateMatchBy, "none">,
  importSource = "source_ingest",
  sourceLabel = candidate.sourceIdentity.source,
): DuplicateReviewFlagDetails {
  return {
    import_source: importSource,
    source: sourceLabel,
    source_identity: {
      source: candidate.sourceIdentity.source,
      source_entity_kind: candidate.sourceIdentity.sourceEntityKind,
      source_id: candidate.sourceIdentity.sourceId,
      source_url: candidate.sourceIdentity.sourceUrl ?? null,
      canonical_title: candidate.sourceIdentity.canonicalTitle ?? null,
      external_ids: candidate.sourceIdentity.externalIds ?? {},
    },
    candidate_preview:
      candidate.entityKind === "composer"
        ? buildComposerPreview(candidate)
        : buildWorkPreview(candidate),
    duplicate_ids: duplicateIds,
    matched_by: matchedBy,
  };
}

async function resolveMaybe<T>(
  value: T | Promise<T>,
): Promise<Awaited<T>> {
  return await value;
}

export async function assessCandidateDuplicates<TCandidate extends IngestCandidate>(
  input: DuplicateAssessmentInput<TCandidate>,
): Promise<DuplicateAssessmentResult<TCandidate>> {
  const issues: IngestIssue[] = [];
  const { candidate, callbacks } = input;
  const importSource = input.importSource ?? "source_ingest";
  const sourceLabel = input.sourceLabel ?? candidate.sourceIdentity.source;

  const sourceMatchEntityId = callbacks?.resolveSourceMatchEntityId
    ? await resolveMaybe(callbacks.resolveSourceMatchEntityId(candidate))
    : null;

  if (sourceMatchEntityId) {
    return {
      candidate,
      sourceMatchEntityId,
      duplicateEntityIds: [],
      shouldFlagDuplicate: false,
      matchedBy: "source_identity",
      issues,
    };
  }

  let duplicateEntityIds: string[] = [];

  if (candidate.entityKind === "composer") {
    if (callbacks?.findDuplicateComposers) {
      const ids = await resolveMaybe(
        callbacks.findDuplicateComposers({
          in_first: candidate.firstName,
          in_last: candidate.lastName,
          in_birth_year: candidate.birthYear ?? null,
        }),
      );
      duplicateEntityIds = ids ?? [];
    } else {
      issues.push({
        code: "duplicate_lookup_unavailable",
        message: "Composer duplicate lookup is not configured.",
        severity: "warning",
      });
    }
  } else {
    if (!input.resolvedComposerId) {
      issues.push({
        code: "missing_composer_context",
        message: "Work duplicate lookup requires a resolved composer id.",
        severity: "error",
      });
    } else if (callbacks?.findDuplicateWorks) {
      const ids = await resolveMaybe(
        callbacks.findDuplicateWorks({
          in_composer_id: input.resolvedComposerId,
          in_work_name: candidate.title,
        }),
      );
      duplicateEntityIds = ids ?? [];
    } else {
      issues.push({
        code: "duplicate_lookup_unavailable",
        message: "Work duplicate lookup is not configured.",
        severity: "warning",
      });
    }
  }

  const shouldFlagDuplicate = duplicateEntityIds.length > 0;

  return {
    candidate,
    sourceMatchEntityId: null,
    duplicateEntityIds,
    shouldFlagDuplicate,
    matchedBy: shouldFlagDuplicate ? "fuzzy" : "none",
    issues,
    reviewFlagDetails: shouldFlagDuplicate
      ? buildDuplicateReviewFlagDetails(
          candidate,
          duplicateEntityIds,
          "fuzzy",
          importSource,
          sourceLabel,
        )
      : undefined,
  };
}
