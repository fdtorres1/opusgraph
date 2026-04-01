import { config } from "dotenv";
import { resolve } from "path";
import { pathToFileURL } from "url";

import { createClient } from "@supabase/supabase-js";

import { processIngestCandidate } from "@/app/api/admin/ingest/_shared";
import { ingestAdapterRegistry } from "@/lib/ingest/adapters";
import type { WorkCandidate } from "@/lib/ingest/candidates";
import type { IngestJobRecord } from "@/lib/ingest/jobs/types";
import type { CandidatePersistResult } from "@/lib/ingest/results";
import type { PersistSupabaseClient } from "@/lib/ingest/persist/support";

config({ path: resolve(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY ?? "";

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY.");
  process.exit(1);
}

interface CliArgs {
  offsetStart: number;
  offsetEnd: number;
  step: number;
  batchSize: number;
  createdBy: string;
  dryRun: boolean;
}

interface ReviewFlagRow {
  id: string;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

interface WorkIdentityRow {
  external_ids: Record<string, unknown> | null;
}

interface CollisionBucketRow {
  id: string;
  entityId: string | null;
  createdAt: string;
  duplicateIds: string[];
}

interface ReplayRow {
  offset: number;
  sourceId: string;
  title: string;
  dryRunOutcome: CandidatePersistResult["outcome"];
  dryRunIssueCodes: string[];
  liveOutcome?: CandidatePersistResult["outcome"];
  liveIssueCodes?: string[];
  liveReviewFlagId?: string;
}

function readBoolean(value: string): boolean {
  return value === "true" || value === "1";
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    offsetStart: 1700,
    offsetEnd: 2900,
    step: 100,
    batchSize: 100,
    createdBy: "f2ed501c-74ad-4c2e-bb66-c97f5a6aa0ba",
    dryRun: true,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];

    switch (token) {
      case "--offset-start":
        args.offsetStart = Number.parseInt(next ?? String(args.offsetStart), 10);
        index += 1;
        break;
      case "--offset-end":
        args.offsetEnd = Number.parseInt(next ?? String(args.offsetEnd), 10);
        index += 1;
        break;
      case "--step":
        args.step = Number.parseInt(next ?? String(args.step), 10);
        index += 1;
        break;
      case "--batch-size":
        args.batchSize = Number.parseInt(next ?? String(args.batchSize), 10);
        index += 1;
        break;
      case "--created-by":
        args.createdBy = next ?? args.createdBy;
        index += 1;
        break;
      case "--dry-run":
        args.dryRun = readBoolean(next ?? String(args.dryRun));
        index += 1;
        break;
      default:
        break;
    }
  }

  return args;
}

function buildSyntheticJob(args: CliArgs, offset: number): IngestJobRecord {
  const now = new Date().toISOString();

  return {
    id: `synthetic:cleanup-imslp-duplicate-review-debt:${offset}`,
    source: "imslp",
    entityKind: "work",
    status: "running",
    mode: "manual",
    priority: 100,
    dryRun: args.dryRun,
    cursor: {
      version: 1,
      strategy: "offset",
      offset,
      batchSize: args.batchSize,
      sort: "id",
      sourceEntityKind: "work",
    },
    options: {
      sourceEntityKind: "work",
    },
    batchSize: args.batchSize,
    limitCount: null,
    processedCount: 0,
    createdCount: 0,
    updatedCount: 0,
    flaggedCount: 0,
    failedCount: 0,
    skippedCount: 0,
    warningCount: 0,
    errorSummary: null,
    warningSummary: null,
    resultSummary: null,
    attemptCount: 1,
    lastErrorAt: null,
    nextRetryAt: null,
    claimedBy: "manual:cleanup-imslp-duplicate-review-debt",
    claimedAt: now,
    lastHeartbeatAt: now,
    createdBy: args.createdBy,
    startedAt: now,
    finishedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function readDuplicateSourceId(details: Record<string, unknown> | null): string | null {
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

  return readString(
    (sourceIdentity as Record<string, unknown>).source_id ??
      (sourceIdentity as Record<string, unknown>).sourceId,
  );
}

function readDuplicateIds(details: Record<string, unknown> | null): string[] {
  if (details == null || !Array.isArray(details.duplicate_ids)) {
    return [];
  }

  return details.duplicate_ids.filter(
    (value): value is string => typeof value === "string" && value.trim().length > 0,
  );
}

function readQuarantineSourceId(details: Record<string, unknown> | null): string | null {
  if (details == null) {
    return null;
  }

  return readString(details.source_id);
}

function readWorkSourceId(externalIds: Record<string, unknown> | null): string | null {
  if (externalIds == null) {
    return null;
  }

  const imslp = externalIds.imslp;
  if (imslp == null || typeof imslp !== "object" || Array.isArray(imslp)) {
    return null;
  }

  return readString(
    (imslp as Record<string, unknown>).source_id ??
      (imslp as Record<string, unknown>).sourceId,
  );
}

async function loadOpenFlagsByReason(
  supabase: PersistSupabaseClient,
  reason: "orchestral_scope_review" | "possible_duplicate",
): Promise<ReviewFlagRow[]> {
  const rows: ReviewFlagRow[] = [];
  const pageSize = 1000;

  for (let from = 0; from < 50000; from += pageSize) {
    const { data, error } = await supabase
      .from("review_flag")
      .select("id, entity_id, details, created_at")
      .eq("entity_type", "work")
      .eq("reason", reason)
      .eq("status", "open")
      .order("created_at", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      break;
    }

    rows.push(...(data as ReviewFlagRow[]));
    if (data.length < pageSize) {
      break;
    }
  }

  return rows;
}

async function loadImslpWorkSourceIds(
  supabase: PersistSupabaseClient,
): Promise<Set<string>> {
  const sourceIds = new Set<string>();
  const pageSize = 1000;

  for (let from = 0; from < 50000; from += pageSize) {
    const { data, error } = await supabase
      .from("work")
      .select("external_ids")
      .not("external_ids", "is", null)
      .range(from, from + pageSize - 1);

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      break;
    }

    for (const row of data as WorkIdentityRow[]) {
      const sourceId = readWorkSourceId(row.external_ids);
      if (sourceId) {
        sourceIds.add(sourceId);
      }
    }

    if (data.length < pageSize) {
      break;
    }
  }

  return sourceIds;
}

function buildDuplicateSourceBuckets(openDuplicates: ReviewFlagRow[]) {
  const buckets = new Map<string, CollisionBucketRow[]>();
  let missingSourceIdentityCount = 0;

  for (const row of openDuplicates) {
    const sourceId = readDuplicateSourceId(row.details);
    if (!sourceId) {
      missingSourceIdentityCount += 1;
      continue;
    }

    const bucket = buckets.get(sourceId) ?? [];
    bucket.push({
      id: row.id,
      entityId: row.entity_id,
      createdAt: row.created_at,
      duplicateIds: readDuplicateIds(row.details),
    });
    buckets.set(sourceId, bucket);
  }

  return {
    buckets,
    missingSourceIdentityCount,
  };
}

function bucketHasSafeDismissShape(rows: CollisionBucketRow[]): boolean {
  if (rows.length < 2) {
    return false;
  }

  const entityIds = new Set(rows.map((row) => row.entityId ?? "__null__"));
  if (entityIds.size !== 1) {
    return false;
  }

  const duplicateIdKeys = new Set(
    rows.map((row) => [...row.duplicateIds].sort().join(",")),
  );
  return duplicateIdKeys.size === 1;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const adapter = ingestAdapterRegistry.imslp;
  if (!adapter) {
    throw new Error("Missing IMSLP adapter.");
  }

  const [openQuarantines, openDuplicates, workSourceIds] = await Promise.all([
    loadOpenFlagsByReason(supabase, "orchestral_scope_review"),
    loadOpenFlagsByReason(supabase, "possible_duplicate"),
    loadImslpWorkSourceIds(supabase),
  ]);

  const quarantineSourceIds = new Set<string>();
  for (const row of openQuarantines) {
    const sourceId = readQuarantineSourceId(row.details);
    if (sourceId) {
      quarantineSourceIds.add(sourceId);
    }
  }

  const duplicateSourceState = buildDuplicateSourceBuckets(openDuplicates);
  const replayed: ReplayRow[] = [];
  const skippedUncovered: Array<{
    offset: number;
    sourceId: string;
    title: string;
    dryRunOutcome: CandidatePersistResult["outcome"];
    dryRunIssueCodes: string[];
  }> = [];

  for (
    let offset = args.offsetStart;
    offset <= args.offsetEnd;
    offset += args.step
  ) {
    const fetched = await adapter.fetchBatch({
      entityKind: "work",
      cursor: {
        version: 1,
        strategy: "offset",
        offset,
        batchSize: args.batchSize,
        sort: "id",
        sourceEntityKind: "work",
      },
      batchSize: args.batchSize,
      options: {
        sourceEntityKind: "work",
      },
    });

    const parsed = await adapter.parseBatch({
      entityKind: "work",
      items: fetched.items,
      options: {
        sourceEntityKind: "work",
      },
    });

    const workCandidates = parsed.candidates.filter(
      (candidate): candidate is WorkCandidate => candidate.entityKind === "work",
    );
    const syntheticJob = buildSyntheticJob(args, offset);

    for (const candidate of workCandidates) {
      const sourceId = candidate.sourceIdentity.sourceId;
      const hasWork = workSourceIds.has(sourceId);
      const hasQuarantine = quarantineSourceIds.has(sourceId);
      const hasDuplicateFlag =
        (duplicateSourceState.buckets.get(sourceId)?.length ?? 0) > 0;

      if (hasWork || hasQuarantine || hasDuplicateFlag) {
        continue;
      }

      const dryRunResult = await processIngestCandidate({
        supabase,
        candidate,
        job: syntheticJob,
        actorUserId: args.createdBy,
        dryRun: true,
      });
      const dryRunIssueCodes = dryRunResult.issues.map((issue) => issue.code);

      if (dryRunResult.outcome !== "flagged_duplicate") {
        skippedUncovered.push({
          offset,
          sourceId,
          title: candidate.title,
          dryRunOutcome: dryRunResult.outcome,
          dryRunIssueCodes,
        });
        continue;
      }

      const replayRow: ReplayRow = {
        offset,
        sourceId,
        title: candidate.title,
        dryRunOutcome: dryRunResult.outcome,
        dryRunIssueCodes,
      };

      if (!args.dryRun) {
        const liveResult = await processIngestCandidate({
          supabase,
          candidate,
          job: syntheticJob,
          actorUserId: args.createdBy,
          dryRun: false,
        });
        replayRow.liveOutcome = liveResult.outcome;
        replayRow.liveIssueCodes = liveResult.issues.map((issue) => issue.code);

        if (liveResult.outcome === "flagged_duplicate") {
          replayRow.liveReviewFlagId = liveResult.reviewFlagId;
          const existing = duplicateSourceState.buckets.get(sourceId) ?? [];
          existing.push({
            id: liveResult.reviewFlagId ?? `synthetic:${sourceId}`,
            entityId: liveResult.duplicateEntityIds?.[0] ?? null,
            createdAt: new Date().toISOString(),
            duplicateIds: liveResult.duplicateEntityIds ?? [],
          });
          duplicateSourceState.buckets.set(sourceId, existing);
        }
      }

      replayed.push(replayRow);
    }
  }

  const collisionBuckets = [...duplicateSourceState.buckets.entries()]
    .filter(([, rows]) => rows.length > 1)
    .sort(([left], [right]) => left.localeCompare(right));

  const dismissedRows: Array<{
    sourceId: string;
    keptFlagId: string;
    dismissedFlagIds: string[];
  }> = [];
  const unsafeCollisionBuckets: Array<{
    sourceId: string;
    flagIds: string[];
    entityIds: Array<string | null>;
  }> = [];

  for (const [sourceId, rows] of collisionBuckets) {
    const orderedRows = [...rows].sort((left, right) =>
      left.createdAt.localeCompare(right.createdAt),
    );

    if (!bucketHasSafeDismissShape(orderedRows)) {
      unsafeCollisionBuckets.push({
        sourceId,
        flagIds: orderedRows.map((row) => row.id),
        entityIds: orderedRows.map((row) => row.entityId),
      });
      continue;
    }

    const [keep, ...dismiss] = orderedRows;
    if (dismiss.length === 0) {
      continue;
    }

    if (!args.dryRun) {
      const { error } = await supabase
        .from("review_flag")
        .update({
          status: "dismissed",
          resolved_by: args.createdBy,
          resolved_at: new Date().toISOString(),
        })
        .in(
          "id",
          dismiss.map((row) => row.id),
        );

      if (error) {
        throw error;
      }
    }

    dismissedRows.push({
      sourceId,
      keptFlagId: keep.id,
      dismissedFlagIds: dismiss.map((row) => row.id),
    });
  }

  const refreshedOpenDuplicates = args.dryRun
    ? openDuplicates
    : await loadOpenFlagsByReason(supabase, "possible_duplicate");
  const refreshedDuplicateSourceState = buildDuplicateSourceBuckets(refreshedOpenDuplicates);
  const remainingCollisionCount = [...refreshedDuplicateSourceState.buckets.values()].filter(
    (rows) => rows.length > 1,
  ).length;

  console.log(
    JSON.stringify(
      {
        dryRun: args.dryRun,
        range: {
          offsetStart: args.offsetStart,
          offsetEnd: args.offsetEnd,
          step: args.step,
          batchSize: args.batchSize,
        },
        uncoveredReplay: {
          attemptedCount: replayed.length,
          replayedCount: args.dryRun
            ? replayed.length
            : replayed.filter((row) => row.liveOutcome === "flagged_duplicate").length,
          sample: replayed.slice(0, 20),
          skippedCount: skippedUncovered.length,
          skippedSample: skippedUncovered.slice(0, 20),
        },
        duplicateCollisionCleanup: {
          dismissedBucketCount: dismissedRows.length,
          dismissedFlagCount: dismissedRows.reduce(
            (count, row) => count + row.dismissedFlagIds.length,
            0,
          ),
          dismissedSample: dismissedRows.slice(0, 20),
          unsafeBucketCount: unsafeCollisionBuckets.length,
          unsafeSample: unsafeCollisionBuckets.slice(0, 20),
        },
        duplicateFlagHygiene: {
          openDuplicateFlagsBefore: openDuplicates.length,
          missingSourceIdentityCountBefore:
            duplicateSourceState.missingSourceIdentityCount,
          openDuplicateFlagsAfter: refreshedOpenDuplicates.length,
          missingSourceIdentityCountAfter:
            refreshedDuplicateSourceState.missingSourceIdentityCount,
          remainingDuplicateSourceIdentityCount: remainingCollisionCount,
        },
      },
      null,
      2,
    ),
  );
}

function isMainModule() {
  const entry = process.argv[1];
  return entry != null && import.meta.url === pathToFileURL(entry).href;
}

if (isMainModule()) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
