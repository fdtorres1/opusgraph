import { config } from "dotenv";
import { resolve } from "path";

import { createClient } from "@supabase/supabase-js";

import type { CandidatePersistResult } from "@/lib/ingest/results";
import type { IngestJobRecord } from "@/lib/ingest/jobs/types";
import type { PersistSupabaseClient } from "@/lib/ingest/persist/support";
import { ingestAdapterRegistry } from "@/lib/ingest/adapters";
import { processIngestCandidate } from "@/app/api/admin/ingest/_shared";

config({ path: resolve(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY ?? "";

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY.");
  process.exit(1);
}

interface CliArgs {
  offset: number;
  batchSize: number;
  createdBy: string;
  sourceIds: string[];
  mode: "none" | "dry-run" | "live";
}

interface ReviewFlagRow {
  id: string;
  details: Record<string, unknown> | null;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    offset: 0,
    batchSize: 100,
    createdBy: "f2ed501c-74ad-4c2e-bb66-c97f5a6aa0ba",
    sourceIds: [],
    mode: "none",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];

    switch (token) {
      case "--offset":
        args.offset = Number.parseInt(next ?? String(args.offset), 10);
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
      case "--source-id":
        if (next) {
          args.sourceIds.push(next);
        }
        index += 1;
        break;
      case "--source-ids":
        if (next) {
          args.sourceIds.push(
            ...next
              .split(",")
              .map((value) => value.trim())
              .filter(Boolean),
          );
        }
        index += 1;
        break;
      case "--include-dry-run":
        args.mode = next === "true" || next === "1" ? "dry-run" : "none";
        index += 1;
        break;
      case "--mode":
        if (next === "none" || next === "dry-run" || next === "live") {
          args.mode = next;
        }
        index += 1;
        break;
      default:
        break;
    }
  }

  return args;
}

function buildSyntheticJob(args: CliArgs): IngestJobRecord {
  const now = new Date().toISOString();

  return {
    id: `synthetic:debug-imslp-work:${args.offset}`,
    source: "imslp",
    entityKind: "work",
    status: "running",
    mode: "manual",
    priority: 100,
    dryRun: args.mode !== "live",
    cursor: {
      version: 1,
      strategy: "offset",
      offset: args.offset,
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
    claimedBy: "manual:debug-imslp-work-slice",
    claimedAt: now,
    lastHeartbeatAt: now,
    createdBy: args.createdBy,
    startedAt: now,
    finishedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

function readSourceIdFromFlag(flag: ReviewFlagRow): string | null {
  const details = flag.details;
  if (details == null) {
    return null;
  }

  const sourceId = details.source_id;
  return typeof sourceId === "string" ? sourceId : null;
}

async function loadOpenQuarantineFlags(
  supabase: PersistSupabaseClient,
): Promise<Map<string, ReviewFlagRow[]>> {
  const flagsBySourceId = new Map<string, ReviewFlagRow[]>();
  const pageSize = 1000;

  for (let from = 0; from < 10000; from += pageSize) {
    const { data, error } = await supabase
      .from("review_flag")
      .select("id, details")
      .eq("reason", "orchestral_scope_review")
      .eq("status", "open")
      .range(from, from + pageSize - 1);

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      break;
    }

    for (const flag of data as ReviewFlagRow[]) {
      const sourceId = readSourceIdFromFlag(flag);
      if (!sourceId) {
        continue;
      }

      const existing = flagsBySourceId.get(sourceId) ?? [];
      existing.push(flag);
      flagsBySourceId.set(sourceId, existing);
    }

    if (data.length < pageSize) {
      break;
    }
  }

  return flagsBySourceId;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const sourceIdFilter =
    args.sourceIds.length > 0 ? new Set(args.sourceIds) : null;

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

  const fetched = await adapter.fetchBatch({
    entityKind: "work",
    cursor: {
      version: 1,
      strategy: "offset",
      offset: args.offset,
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

  const flagsBySourceId = await loadOpenQuarantineFlags(supabase);
  const job = buildSyntheticJob(args);
  const rows: Array<{
    sourceId: string;
    title: string;
    composer: string | null;
    instrumentation: string | null;
      hasOpenQuarantineFlag: boolean;
      processOutcome?: CandidatePersistResult["outcome"];
      processIssueCodes?: string[];
    }> = [];

  for (const candidate of parsed.candidates) {
    if (candidate.entityKind !== "work") {
      continue;
    }

    if (
      sourceIdFilter != null &&
      !sourceIdFilter.has(candidate.sourceIdentity.sourceId)
    ) {
      continue;
    }

    const row: {
      sourceId: string;
      title: string;
      composer: string | null;
      instrumentation: string | null;
      hasOpenQuarantineFlag: boolean;
      processOutcome?: CandidatePersistResult["outcome"];
      processIssueCodes?: string[];
    } = {
      sourceId: candidate.sourceIdentity.sourceId,
      title: candidate.title,
      composer: candidate.composerDisplayName ?? null,
      instrumentation: candidate.instrumentationText ?? null,
      hasOpenQuarantineFlag: flagsBySourceId.has(candidate.sourceIdentity.sourceId),
    };

    if (args.mode !== "none") {
      const result = await processIngestCandidate({
        supabase,
        candidate,
        job,
        actorUserId: args.createdBy,
        dryRun: args.mode === "dry-run",
      });
      row.processOutcome = result.outcome;
      row.processIssueCodes = result.issues.map((issue) => issue.code);
    }

    rows.push(row);
  }

  console.log(
    JSON.stringify(
      {
        offset: args.offset,
        batchSize: args.batchSize,
        rowCount: rows.length,
        rows,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
