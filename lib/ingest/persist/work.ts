import { detectRecording } from "@/lib/recording";
import type { WorkCandidate } from "@/lib/ingest/candidates";
import type { CandidatePersistResult } from "@/lib/ingest/results";
import { assessCandidateDuplicates } from "@/lib/ingest/persist/duplicate";
import { findSourceIdentityMatch } from "@/lib/ingest/persist/source-identity";
import {
  createDuplicateReviewFlag,
  insertRevision,
  issue,
  mergeExternalIds,
  mergeExtraMetadata,
  normalizeOrderedUrls,
  type PersistEntityOptions,
  type PersistSupabaseClient,
} from "@/lib/ingest/persist/support";
import { parseDuration } from "@/lib/duration";

interface PersistWorkInput {
  supabase: PersistSupabaseClient;
  candidate: WorkCandidate;
  options: PersistEntityOptions & {
    resolvedComposerId?: string | null;
    resolveComposerId?: (candidate: WorkCandidate) => Promise<string | null>;
  };
}

async function resolvePublisherId(
  supabase: PersistSupabaseClient,
  publisherName: string | null | undefined,
): Promise<string | null> {
  if (!publisherName?.trim()) {
    return null;
  }

  const name = publisherName.trim();
  const { data: existing } = await supabase
    .from("publisher")
    .select("id")
    .eq("name", name)
    .maybeSingle();

  if (existing?.id) {
    return existing.id;
  }

  const { data: created } = await supabase
    .from("publisher")
    .insert({ name })
    .select("id")
    .single();

  return created?.id ?? null;
}

export async function persistWorkCandidate({
  supabase,
  candidate,
  options,
}: PersistWorkInput): Promise<CandidatePersistResult> {
  if (!candidate.title.trim()) {
    return {
      outcome: "failed_parse",
      entityKind: "work",
      candidate,
      sourceIdentity: candidate.sourceIdentity,
      issues: [
        issue("missing_work_title", "Work persistence requires a title."),
      ],
    };
  }

  const resolvedComposerId =
    options.resolvedComposerId ??
    (options.resolveComposerId
      ? await options.resolveComposerId(candidate)
      : null);

  if (!resolvedComposerId) {
    return {
      outcome: "failed_parse",
      entityKind: "work",
      candidate,
      sourceIdentity: candidate.sourceIdentity,
      issues: [
        issue(
          "missing_resolved_composer_id",
          "Work persistence requires a resolved composer id.",
        ),
      ],
    };
  }

  const sourceMatch = await findSourceIdentityMatch(
    supabase,
    "work",
    candidate.sourceIdentity,
  );

  if (sourceMatch && options.onSourceMatch === "skip") {
    return {
      outcome: "skipped_existing_source_match",
      entityKind: "work",
      entityId: sourceMatch.entityId,
      sourceIdentity: candidate.sourceIdentity,
      candidate,
      matchedBy: "source_identity",
      issues: [],
    };
  }

  const duplicateAssessment = await assessCandidateDuplicates({
    candidate,
    importSource: options.importSource,
    resolvedComposerId,
    callbacks: {
      resolveSourceMatchEntityId: () => sourceMatch?.entityId ?? null,
      findDuplicateWorks: async (input) => {
        const { data } = await supabase.rpc("find_duplicate_works", input);
        return data ?? [];
      },
    },
  });

  if (duplicateAssessment.shouldFlagDuplicate && options.flagDuplicates !== false) {
    const reviewFlagId = await createDuplicateReviewFlag(
      supabase,
      "work",
      duplicateAssessment.duplicateEntityIds[0],
      options.actorUserId,
      duplicateAssessment.reviewFlagDetails!,
    );

    return {
      outcome: "flagged_duplicate",
      entityKind: "work",
      sourceIdentity: candidate.sourceIdentity,
      candidate,
      duplicateEntityIds: duplicateAssessment.duplicateEntityIds,
      reviewFlagId: reviewFlagId ?? undefined,
      issues: duplicateAssessment.issues,
    };
  }

  const existingRow = sourceMatch
    ? await supabase
        .from("work")
        .select("id, status, external_ids, extra_metadata")
        .eq("id", sourceMatch.entityId)
        .single()
        .then(({ data }) => data)
    : null;

  let durationSeconds: number | null = null;
  if (candidate.durationText?.trim()) {
    durationSeconds = parseDuration(candidate.durationText.trim());
    if (durationSeconds == null) {
      return {
        outcome: "failed_parse",
        entityKind: "work",
        candidate,
        sourceIdentity: candidate.sourceIdentity,
        issues: [
          issue(
            "invalid_duration_text",
            `Work duration could not be parsed: ${candidate.durationText}`,
          ),
        ],
      };
    }
  }

  const publisherId = await resolvePublisherId(supabase, candidate.publisher);

  const rowPayload = {
    work_name: candidate.title.trim(),
    composer_id: resolvedComposerId,
    composition_year: candidate.compositionYear ?? null,
    instrumentation_text: candidate.instrumentationText ?? null,
    duration_seconds: durationSeconds,
    publisher_id: publisherId,
    opus_number: candidate.opusNumber ?? null,
    catalog_number: candidate.catalogNumber ?? null,
    movements: candidate.movements ?? null,
    status: existingRow?.status ?? "draft",
    external_ids: mergeExternalIds(existingRow?.external_ids, candidate),
    extra_metadata: mergeExtraMetadata(existingRow?.extra_metadata, candidate),
  };

  const query = sourceMatch
    ? supabase.from("work").update(rowPayload).eq("id", sourceMatch.entityId)
    : supabase.from("work").insert(rowPayload);

  const { data: persisted, error } = await query.select("*").single();

  if (error || !persisted) {
    return {
      outcome: "failed_write",
      entityKind: "work",
      sourceIdentity: candidate.sourceIdentity,
      candidate,
      issues: [
        issue("work_write_failed", error?.message ?? "Work write failed."),
      ],
    };
  }

  const sources = normalizeOrderedUrls(candidate.sources);
  await supabase.from("work_source").delete().eq("work_id", persisted.id);
  if (sources.length) {
    await supabase.from("work_source").insert(
      sources.map((source) => ({
        work_id: persisted.id,
        url: source.url,
        title: source.title ?? null,
        display_order: source.displayOrder,
      })),
    );
  }

  const recordings = normalizeOrderedUrls(candidate.recordings);
  await supabase.from("work_recording").delete().eq("work_id", persisted.id);
  if (recordings.length) {
    await supabase.from("work_recording").insert(
      recordings.map((recording) => {
        const detected = detectRecording(recording.url);
        return {
          work_id: persisted.id,
          url: recording.url,
          provider: detected?.provider ?? "other",
          provider_key: detected?.key ?? null,
          embed_url: detected?.embedUrl ?? null,
          display_order: recording.displayOrder,
        };
      }),
    );
  }

  const action = sourceMatch ? "update" : "create";
  await insertRevision(
    supabase,
    "work",
    persisted.id,
    options.actorUserId,
    action,
    persisted,
  );

  return {
    outcome: sourceMatch ? "updated" : "created",
    entityKind: "work",
    entityId: persisted.id,
    sourceIdentity: candidate.sourceIdentity,
    candidate,
    issues: duplicateAssessment.issues,
  };
}
