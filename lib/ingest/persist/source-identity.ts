import type { SupabaseClient } from "@supabase/supabase-js";

import type { IngestEntityKind, JsonObject } from "@/lib/ingest/domain";
import type { SourceIdentity } from "@/lib/ingest/candidates";

export type SourceIdentityMatchBy =
  | "source_id"
  | "source_url"
  | "canonical_title";

export interface SourceIdentityLookupResult {
  entityKind: IngestEntityKind;
  entityId: string;
  matchedBy: SourceIdentityMatchBy;
  sourceIdentity: SourceIdentity;
  externalIds: JsonObject;
}

export function buildSourceIdentityBucket(
  sourceIdentity: SourceIdentity,
): JsonObject {
  return {
    source_id: sourceIdentity.sourceId,
    source_entity_kind: sourceIdentity.sourceEntityKind,
    ...(sourceIdentity.sourceUrl
      ? { source_url: sourceIdentity.sourceUrl }
      : {}),
    ...(sourceIdentity.canonicalTitle
      ? { canonical_title: sourceIdentity.canonicalTitle }
      : {}),
    ...(sourceIdentity.externalIds ?? {}),
  };
}

interface SourceIdentityRow {
  id: string;
  external_ids: JsonObject | null;
}

type Awaitable<T> = T | PromiseLike<T>;

export type SourceIdentityLookupClient = SupabaseClient<any, "public", any>;

function isPlainObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getSourceBucket(
  externalIds: JsonObject | null | undefined,
  source: string,
): JsonObject | null {
  if (!isPlainObject(externalIds)) {
    return null;
  }

  const bucket = externalIds[source];
  return isPlainObject(bucket) ? bucket : null;
}

function readString(bucket: JsonObject, keys: string[]): string | null {
  for (const key of keys) {
    const value = bucket[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

function buildFilterCandidates(sourceIdentity: SourceIdentity): JsonObject[] {
  const filters: JsonObject[] = [];
  const sourceBucket = { [sourceIdentity.source]: {} as JsonObject };

  if (sourceIdentity.sourceId.trim().length > 0) {
    filters.push({
      [sourceIdentity.source]: { sourceId: sourceIdentity.sourceId.trim() },
    });
    filters.push({
      [sourceIdentity.source]: { source_id: sourceIdentity.sourceId.trim() },
    });
  }

  if (sourceIdentity.sourceUrl?.trim()) {
    const sourceUrl = sourceIdentity.sourceUrl.trim();
    filters.push({
      [sourceIdentity.source]: { sourceUrl },
    });
    filters.push({
      [sourceIdentity.source]: { source_url: sourceUrl },
    });
  }

  if (sourceIdentity.canonicalTitle?.trim()) {
    const canonicalTitle = sourceIdentity.canonicalTitle.trim();
    filters.push({
      [sourceIdentity.source]: { canonicalTitle },
    });
    filters.push({
      [sourceIdentity.source]: { canonical_title: canonicalTitle },
    });
  }

  if (sourceIdentity.sourceEntityKind.trim().length > 0) {
    sourceBucket[sourceIdentity.source] = {
      sourceEntityKind: sourceIdentity.sourceEntityKind.trim(),
    };
    filters.unshift(sourceBucket);
  }

  return filters;
}

export function matchesSourceIdentity(
  externalIds: JsonObject | null | undefined,
  sourceIdentity: SourceIdentity,
): SourceIdentityMatchBy | null {
  const bucket = getSourceBucket(externalIds, sourceIdentity.source);
  if (!bucket) {
    return null;
  }

  const storedEntityKind = readString(bucket, [
    "sourceEntityKind",
    "source_entity_kind",
  ]);
  if (
    sourceIdentity.sourceEntityKind.trim().length > 0 &&
    storedEntityKind &&
    storedEntityKind !== sourceIdentity.sourceEntityKind.trim()
  ) {
    return null;
  }

  const sourceId = sourceIdentity.sourceId.trim();
  if (sourceId.length > 0) {
    const storedSourceId = readString(bucket, ["sourceId", "source_id"]);
    if (storedSourceId === sourceId) {
      return "source_id";
    }
  }

  const sourceUrl = sourceIdentity.sourceUrl?.trim();
  if (sourceUrl) {
    const storedSourceUrl = readString(bucket, ["sourceUrl", "source_url"]);
    if (storedSourceUrl === sourceUrl) {
      return "source_url";
    }
  }

  const canonicalTitle = sourceIdentity.canonicalTitle?.trim();
  if (canonicalTitle) {
    const storedCanonicalTitle = readString(bucket, [
      "canonicalTitle",
      "canonical_title",
    ]);
    if (storedCanonicalTitle === canonicalTitle) {
      return "canonical_title";
    }
  }

  return null;
}

async function fetchRowsBySourceIdentity(
  client: SourceIdentityLookupClient,
  entityKind: IngestEntityKind,
  sourceIdentity: SourceIdentity,
): Promise<SourceIdentityRow[]> {
  const filters = buildFilterCandidates(sourceIdentity);
  const rows: SourceIdentityRow[] = [];
  const seenIds = new Set<string>();

  for (const filter of filters) {
    const response = await client
      .from(entityKind)
      .select("id, external_ids")
      .contains("external_ids", filter)
      .limit(25);
    const { data, error } = response as {
      data: SourceIdentityRow[] | null;
      error: { message: string } | null;
    };

    if (error || !data) {
      continue;
    }

    for (const row of data) {
      if (!row?.id || seenIds.has(row.id)) {
        continue;
      }

      seenIds.add(row.id);
      rows.push(row);
    }
  }

  return rows;
}

export async function findSourceIdentityMatch(
  client: SourceIdentityLookupClient,
  entityKind: IngestEntityKind,
  sourceIdentity: SourceIdentity,
): Promise<SourceIdentityLookupResult | null> {
  const rows = await fetchRowsBySourceIdentity(client, entityKind, sourceIdentity);

  for (const row of rows) {
    const matchedBy = matchesSourceIdentity(row.external_ids, sourceIdentity);
    if (!matchedBy) {
      continue;
    }

    return {
      entityKind,
      entityId: row.id,
      matchedBy,
      sourceIdentity,
      externalIds: row.external_ids ?? {},
    };
  }

  return null;
}
