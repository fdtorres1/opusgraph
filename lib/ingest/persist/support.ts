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
