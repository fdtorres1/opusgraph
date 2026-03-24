import type { ComposerCandidate } from "@/lib/ingest/candidates";
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

interface PersistComposerInput {
  supabase: PersistSupabaseClient;
  candidate: ComposerCandidate;
  options: PersistEntityOptions;
}

export async function persistComposerCandidate({
  supabase,
  candidate,
  options,
}: PersistComposerInput): Promise<CandidatePersistResult> {
  if (!candidate.firstName.trim() && !candidate.lastName.trim()) {
    return {
      outcome: "failed_parse",
      entityKind: "composer",
      candidate,
      sourceIdentity: candidate.sourceIdentity,
      issues: [
        issue(
          "missing_composer_name",
          "Composer persistence requires at least one of firstName or lastName.",
        ),
      ],
    };
  }

  const sourceMatch = await findSourceIdentityMatch(
    supabase,
    "composer",
    candidate.sourceIdentity,
  );

  if (sourceMatch && options.onSourceMatch === "skip") {
    return {
      outcome: "skipped_existing_source_match",
      entityKind: "composer",
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
    callbacks: {
      resolveSourceMatchEntityId: () => sourceMatch?.entityId ?? null,
      findDuplicateComposers: async (input) => {
        const { data } = await supabase.rpc("find_duplicate_composers", input);
        return data ?? [];
      },
    },
  });

  if (duplicateAssessment.shouldFlagDuplicate && options.flagDuplicates !== false) {
    const reviewFlagId = await createDuplicateReviewFlag(
      supabase,
      "composer",
      duplicateAssessment.duplicateEntityIds[0],
      options.actorUserId,
      duplicateAssessment.reviewFlagDetails!,
    );

    return {
      outcome: "flagged_duplicate",
      entityKind: "composer",
      sourceIdentity: candidate.sourceIdentity,
      candidate,
      duplicateEntityIds: duplicateAssessment.duplicateEntityIds,
      reviewFlagId: reviewFlagId ?? undefined,
      issues: duplicateAssessment.issues,
    };
  }

  const existingRow = sourceMatch
    ? await supabase
        .from("composer")
        .select("id, status, external_ids, extra_metadata")
        .eq("id", sourceMatch.entityId)
        .single()
        .then(({ data }) => data)
    : null;

  const rowPayload = {
    first_name: candidate.firstName.trim(),
    last_name: candidate.lastName.trim(),
    birth_year: candidate.birthYear ?? null,
    death_year: candidate.deathYear ?? null,
    gender_id: candidate.genderId ?? null,
    status: existingRow?.status ?? "draft",
    external_ids: mergeExternalIds(existingRow?.external_ids, candidate),
    extra_metadata: mergeExtraMetadata(existingRow?.extra_metadata, candidate),
  };

  const query = sourceMatch
    ? supabase.from("composer").update(rowPayload).eq("id", sourceMatch.entityId)
    : supabase.from("composer").insert(rowPayload);

  const { data: persisted, error } = await query.select("*").single();

  if (error || !persisted) {
    return {
      outcome: "failed_write",
      entityKind: "composer",
      sourceIdentity: candidate.sourceIdentity,
      candidate,
      issues: [
        issue(
          "composer_write_failed",
          error?.message ?? "Composer write failed.",
        ),
      ],
    };
  }

  await supabase.from("composer_nationality").delete().eq("composer_id", persisted.id);
  if (candidate.nationalityCodes?.length) {
    await supabase.from("composer_nationality").insert(
      candidate.nationalityCodes.map((countryIso2) => ({
        composer_id: persisted.id,
        country_iso2: countryIso2,
      })),
    );
  }

  const links = normalizeOrderedUrls(candidate.links);
  await supabase.from("composer_link").delete().eq("composer_id", persisted.id);
  if (links.length) {
    await supabase.from("composer_link").insert(
      links.map((link) => ({
        composer_id: persisted.id,
        url: link.url,
        is_primary: link.isPrimary,
        display_order: link.displayOrder,
      })),
    );
  }

  const action = sourceMatch ? "update" : "create";
  await insertRevision(
    supabase,
    "composer",
    persisted.id,
    options.actorUserId,
    action,
    persisted,
  );

  return {
    outcome: sourceMatch ? "updated" : "created",
    entityKind: "composer",
    entityId: persisted.id,
    sourceIdentity: candidate.sourceIdentity,
    candidate,
    issues: duplicateAssessment.issues,
  };
}
