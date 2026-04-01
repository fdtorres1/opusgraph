import type { SupabaseClient } from "@supabase/supabase-js";

import type { IngestCandidate } from "@/lib/ingest/candidates";
import type { IngestEntityKind, IngestIssue, JsonObject } from "@/lib/ingest/domain";
import { buildSourceIdentityBucket } from "@/lib/ingest/persist/source-identity";

export type PersistSupabaseClient = SupabaseClient<any, "public", any>;

export interface PersistEntityOptions {
  actorUserId: string;
  onSourceMatch?: "skip" | "update";
  flagDuplicates?: boolean;
  importSource?: string;
}

export interface PersistedRow {
  id: string;
  status?: string | null;
  external_ids?: JsonObject | null;
  extra_metadata?: JsonObject | null;
}

export function mergeExternalIds(
  existingExternalIds: JsonObject | null | undefined,
  candidate: IngestCandidate,
): JsonObject {
  return {
    ...(existingExternalIds ?? {}),
    [candidate.sourceIdentity.source]: buildSourceIdentityBucket(
      candidate.sourceIdentity,
    ),
  };
}

export function mergeExtraMetadata(
  existingExtraMetadata: JsonObject | null | undefined,
  candidate: IngestCandidate,
): JsonObject {
  if (!candidate.extraMetadata) {
    return existingExtraMetadata ?? {};
  }

  return {
    ...(existingExtraMetadata ?? {}),
    [candidate.sourceIdentity.source]: candidate.extraMetadata,
  };
}

export async function createDuplicateReviewFlag(
  supabase: PersistSupabaseClient,
  entityKind: IngestEntityKind,
  entityId: string,
  actorUserId: string,
  details: JsonObject,
): Promise<string | null> {
  const existingForEntity = await supabase
    .from("review_flag")
    .select("id, details")
    .eq("entity_type", entityKind)
    .eq("entity_id", entityId)
    .eq("reason", "possible_duplicate")
    .eq("status", "open");

  const expectedSourceIdentity = readDuplicateFlagSourceIdentity(details);
  if (
    !existingForEntity.error &&
    Array.isArray(existingForEntity.data) &&
    existingForEntity.data.length > 0
  ) {
    for (const row of existingForEntity.data) {
      const currentSourceIdentity = readDuplicateFlagSourceIdentity(
        row.details as JsonObject | null | undefined,
      );
      if (
        expectedSourceIdentity != null &&
        currentSourceIdentity != null &&
        currentSourceIdentity === expectedSourceIdentity
      ) {
        return row.id ?? null;
      }
    }
  }

  const { data, error } = await supabase
    .from("review_flag")
    .insert({
      entity_type: entityKind,
      entity_id: entityId,
      reason: "possible_duplicate",
      details,
      status: "open",
      created_by: actorUserId,
    })
    .select("id")
    .single();

  if (error) {
    return null;
  }

  return data?.id ?? null;
}

function readDuplicateFlagSourceIdentity(
  details: JsonObject | null | undefined,
): string | null {
  if (details == null) {
    return null;
  }

  const sourceIdentity = details.source_identity;
  if (
    sourceIdentity == null ||
    typeof sourceIdentity !== "object" ||
    Array.isArray(sourceIdentity)
  ) {
    return null;
  }

  const source = typeof sourceIdentity.source === "string"
    ? sourceIdentity.source.trim()
    : "";
  const sourceEntityKind = typeof sourceIdentity.source_entity_kind === "string"
    ? sourceIdentity.source_entity_kind.trim()
    : typeof sourceIdentity.sourceEntityKind === "string"
      ? sourceIdentity.sourceEntityKind.trim()
      : "";
  const sourceId = typeof sourceIdentity.source_id === "string"
    ? sourceIdentity.source_id.trim()
    : typeof sourceIdentity.sourceId === "string"
      ? sourceIdentity.sourceId.trim()
      : "";

  if (!source || !sourceEntityKind || !sourceId) {
    return null;
  }

  return `${source}:${sourceEntityKind}:${sourceId}`;
}

export async function createOrReuseReviewFlag(
  supabase: PersistSupabaseClient,
  entityKind: IngestEntityKind,
  entityId: string,
  reason: string,
  actorUserId: string,
  details: JsonObject,
): Promise<string | null> {
  const { data: existing } = await supabase
    .from("review_flag")
    .select("id")
    .eq("entity_type", entityKind)
    .eq("entity_id", entityId)
    .eq("reason", reason)
    .eq("status", "open")
    .maybeSingle();

  if (existing?.id) {
    return existing.id;
  }

  const { data, error } = await supabase
    .from("review_flag")
    .insert({
      entity_type: entityKind,
      entity_id: entityId,
      reason,
      details,
      status: "open",
      created_by: actorUserId,
    })
    .select("id")
    .single();

  if (error) {
    return null;
  }

  return data?.id ?? null;
}

export async function quarantineWorkEntity(
  supabase: PersistSupabaseClient,
  entityId: string,
  actorUserId: string,
  reason: string,
  details: JsonObject,
): Promise<{ reviewFlagId: string | null; row: JsonObject | null }> {
  const { data: currentRow } = await supabase
    .from("work")
    .select("*")
    .eq("id", entityId)
    .single();

  let row = currentRow ?? null;
  if (currentRow) {
    const updatePayload: Record<string, unknown> = {};

    if (currentRow.status !== "draft") {
      updatePayload.status = "draft";
    }

    const source = typeof details.source === "string" ? details.source : null;
    if (source === "imslp") {
      const existingExtraMetadata =
        currentRow.extra_metadata &&
        typeof currentRow.extra_metadata === "object" &&
        !Array.isArray(currentRow.extra_metadata)
          ? (currentRow.extra_metadata as JsonObject)
          : {};
      const existingImslp =
        existingExtraMetadata.imslp &&
        typeof existingExtraMetadata.imslp === "object" &&
        !Array.isArray(existingExtraMetadata.imslp)
          ? (existingExtraMetadata.imslp as JsonObject)
          : {};

      updatePayload.extra_metadata = {
        ...existingExtraMetadata,
        imslp: {
          ...existingImslp,
          orchestral_scope: {
            classification:
              typeof details.classification === "string"
                ? details.classification
                : null,
            reason:
              typeof details.classification_reason === "string"
                ? details.classification_reason
                : null,
            matched_signals: Array.isArray(details.matched_signals)
              ? details.matched_signals
              : [],
            normalized_instrumentation_text:
              typeof details.normalized_instrumentation_text === "string"
                ? details.normalized_instrumentation_text
                : null,
          },
        },
      } satisfies JsonObject;
    }

    if (Object.keys(updatePayload).length > 0) {
    const { data: drafted } = await supabase
      .from("work")
      .update(updatePayload)
      .eq("id", entityId)
      .select("*")
      .single();

      row = drafted ?? currentRow;
      if (row) {
        await insertRevision(supabase, "work", entityId, actorUserId, "update", row);
      }
    }
  }

  const reviewFlagId = await createOrReuseReviewFlag(
    supabase,
    "work",
    entityId,
    reason,
    actorUserId,
    details,
  );

  return {
    reviewFlagId,
    row,
  };
}

export async function insertRevision(
  supabase: PersistSupabaseClient,
  entityKind: IngestEntityKind,
  entityId: string,
  actorUserId: string,
  action: "create" | "update",
  snapshot: JsonObject,
): Promise<void> {
  await supabase.from("revision").insert({
    entity_type: entityKind,
    entity_id: entityId,
    actor_user_id: actorUserId,
    action,
    snapshot,
  });
}

export function issue(
  code: string,
  message: string,
  severity: IngestIssue["severity"] = "error",
  metadata?: JsonObject,
): IngestIssue {
  return {
    code,
    message,
    severity,
    ...(metadata ? { metadata } : {}),
  };
}

export type OrderedUrlInput =
  | string
  | {
      url: string;
      title?: string | null;
      displayOrder?: number;
      isPrimary?: boolean;
    };

export function normalizeOrderedUrls(
  values: OrderedUrlInput[] | undefined,
): Array<{
  url: string;
  title?: string | null;
  displayOrder: number;
  isPrimary: boolean;
}> {
  if (!values?.length) {
    return [];
  }

  return values.map((value, index) => {
    if (typeof value === "string") {
      return {
        url: value,
        displayOrder: index,
        isPrimary: index === 0,
      };
    }

    return {
      url: value.url,
      title: value.title ?? null,
      displayOrder: value.displayOrder ?? index,
      isPrimary: value.isPrimary ?? index === 0,
    };
  });
}
