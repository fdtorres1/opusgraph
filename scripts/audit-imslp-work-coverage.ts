import { config } from "dotenv";
import { resolve } from "path";
import { pathToFileURL } from "url";

import { createClient } from "@supabase/supabase-js";

import { ingestAdapterRegistry } from "@/lib/ingest/adapters";
import { processIngestCandidate } from "@/app/api/admin/ingest/_shared";
import type { WorkCandidate } from "@/lib/ingest/candidates";
import type { CandidatePersistResult } from "@/lib/ingest/results";
import type { IngestJobRecord } from "@/lib/ingest/jobs/types";
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
}

interface ReviewFlagRow {
  id: string;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

interface WorkIdentityRow {
  id: string;
  external_ids: Record<string, unknown> | null;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    offsetStart: 1700,
    offsetEnd: 2900,
    step: 100,
    batchSize: 100,
    createdBy: "f2ed501c-74ad-4c2e-bb66-c97f5a6aa0ba",
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
      default:
        break;
    }
  }

  return args;
}

function buildSyntheticJob(args: CliArgs, offset: number): IngestJobRecord {
  const now = new Date().toISOString();

  return {
    id: `synthetic:audit-imslp-work:${offset}`,
    source: "imslp",
    entityKind: "work",
    status: "running",
    mode: "manual",
    priority: 100,
    dryRun: true,
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
    claimedBy: "manual:audit-imslp-work-coverage",
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

function readQuarantineSourceId(details: Record<string, unknown> | null): string | null {
  if (details == null) {
    return null;
  }

  return readString(details.source_id);
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
      .select("id, external_ids")
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

  const duplicateSourceBuckets = new Map<
    string,
    Array<{ id: string; entityId: string | null; createdAt: string }>
  >();
  let duplicateFlagsMissingSourceIdentity = 0;

  for (const row of openDuplicates) {
    const sourceId = readDuplicateSourceId(row.details);
    if (!sourceId) {
      duplicateFlagsMissingSourceIdentity += 1;
      continue;
    }

    const existing = duplicateSourceBuckets.get(sourceId) ?? [];
    existing.push({
      id: row.id,
      entityId: row.entity_id,
      createdAt: row.created_at,
    });
    duplicateSourceBuckets.set(sourceId, existing);
  }

  const slices = [];
  const uncoveredOverall: Array<{ offset: number; sourceId: string; title: string }> = [];

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

    const rows = workCandidates
      .map((candidate) => {
        const sourceId = candidate.sourceIdentity.sourceId;
        const hasWork = workSourceIds.has(sourceId);
        const hasQuarantine = quarantineSourceIds.has(sourceId);
        const duplicateRows = duplicateSourceBuckets.get(sourceId) ?? [];

        return {
          sourceId,
          title: candidate.title,
          hasWork,
          hasQuarantine,
          duplicateCount: duplicateRows.length,
          isCovered: hasWork || hasQuarantine || duplicateRows.length > 0,
        };
      });

    const uncoveredCandidates = workCandidates.filter(
      (candidate) =>
        rows.some(
          (row) =>
            row.sourceId === candidate.sourceIdentity.sourceId && !row.isCovered,
        ),
    );

    const syntheticJob = buildSyntheticJob(args, offset);
    const uncovered = await Promise.all(
      uncoveredCandidates.map(async (candidate) => {
        const result = await processIngestCandidate({
          supabase,
          candidate,
          job: syntheticJob,
          actorUserId: args.createdBy,
          dryRun: true,
        });

        return {
          offset,
          sourceId: candidate.sourceIdentity.sourceId,
          title: candidate.title,
          dryRunOutcome: result.outcome,
          issueCodes: result.issues.map((issue) => issue.code),
        };
      }),
    );

    uncoveredOverall.push(...uncovered);

    slices.push({
      offset,
      candidateCount: rows.length,
      coveredCount: rows.length - uncovered.length,
      uncoveredCount: uncovered.length,
      persistedWorkCount: rows.filter((row) => row.hasWork).length,
      quarantineCount: rows.filter((row) => row.hasQuarantine).length,
      duplicateOnlyCount: rows.filter(
        (row) => !row.hasWork && !row.hasQuarantine && row.duplicateCount > 0,
      ).length,
      duplicateCollisionCount: rows.filter((row) => row.duplicateCount > 1).length,
      uncoveredOutcomeCounts: uncovered.reduce<Record<string, number>>((acc, row) => {
        acc[row.dryRunOutcome] = (acc[row.dryRunOutcome] ?? 0) + 1;
        return acc;
      }, {}),
      uncoveredSample: uncovered.slice(0, 10),
    });
  }

  const duplicateCollisions = [...duplicateSourceBuckets.entries()]
    .filter(([, rows]) => rows.length > 1)
    .map(([sourceId, rows]) => ({
      sourceId,
      count: rows.length,
      rows,
    }))
    .sort((left, right) => left.sourceId.localeCompare(right.sourceId));

  console.log(
    JSON.stringify(
      {
        range: {
          offsetStart: args.offsetStart,
          offsetEnd: args.offsetEnd,
          step: args.step,
          batchSize: args.batchSize,
        },
        duplicateFlagHygiene: {
          openDuplicateFlags: openDuplicates.length,
          missingSourceIdentityCount: duplicateFlagsMissingSourceIdentity,
          duplicateSourceIdentityCount: duplicateCollisions.length,
          duplicateSourceIdentitySample: duplicateCollisions.slice(0, 20),
        },
        slices,
        summary: {
          auditedSlices: slices.length,
          uncoveredCount: uncoveredOverall.length,
          uncoveredSample: uncoveredOverall.slice(0, 20),
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
