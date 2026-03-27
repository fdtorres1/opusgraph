import { config } from "dotenv";
import { resolve } from "path";

import { createClient } from "@supabase/supabase-js";

import type { ComposerCandidate, WorkCandidate } from "@/lib/ingest/candidates";
import type { CandidatePersistResult } from "@/lib/ingest/results";
import type { IngestJobRecord } from "@/lib/ingest/jobs/types";
import { ingestAdapterRegistry } from "@/lib/ingest/adapters";
import { parseImslpCanonicalName } from "@/lib/ingest/adapters/imslp/parser";
import { processIngestCandidate } from "@/app/api/admin/ingest/_shared";
import { persistComposerCandidate } from "@/lib/ingest/persist";

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
}

function parseArgs(argv: string[]): CliArgs {
  const defaults: CliArgs = {
    offset: 0,
    batchSize: 100,
    createdBy: "f2ed501c-74ad-4c2e-bb66-c97f5a6aa0ba",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];

    switch (token) {
      case "--offset":
        defaults.offset = Number.parseInt(next ?? String(defaults.offset), 10);
        index += 1;
        break;
      case "--batch-size":
        defaults.batchSize = Number.parseInt(next ?? String(defaults.batchSize), 10);
        index += 1;
        break;
      case "--created-by":
        defaults.createdBy = next ?? defaults.createdBy;
        index += 1;
        break;
      default:
        break;
    }
  }

  return defaults;
}

function buildSyntheticJob(args: CliArgs): IngestJobRecord {
  const now = new Date().toISOString();

  return {
    id: `synthetic:imslp-work:${args.offset}`,
    source: "imslp",
    entityKind: "work",
    status: "running",
    mode: "manual",
    priority: 100,
    dryRun: true,
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
    claimedBy: "manual:seed-imslp-work-composers",
    claimedAt: now,
    lastHeartbeatAt: now,
    createdBy: args.createdBy,
    startedAt: now,
    finishedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

function makeComposerCandidate(
  workCandidate: WorkCandidate,
  offset: number,
): ComposerCandidate | null {
  const sourceId =
    workCandidate.composerSourceId?.trim() ??
    workCandidate.composerDisplayName?.trim() ??
    "";

  if (!sourceId) {
    return null;
  }

  const parsed = parseImslpCanonicalName(sourceId);
  const displayName = parsed.displayName.trim();
  const firstName = parsed.firstName.trim();
  const lastName = parsed.lastName.trim();

  if (!displayName || (!firstName && !lastName)) {
    return null;
  }

  return {
    entityKind: "composer",
    sourceIdentity: {
      source: "imslp",
      sourceEntityKind: "person",
      sourceId,
      canonicalTitle: sourceId,
      externalIds: {
        source_entity_kind: "person",
        canonical_title: sourceId,
        list_type: 1,
        list_id: sourceId,
        derived_from_work_source_id: workCandidate.sourceIdentity.sourceId,
      },
    },
    rawPayload: {
      derived_from: "imslp_work_candidate",
      derived_from_work_source_id: workCandidate.sourceIdentity.sourceId,
      derived_from_work_title: workCandidate.title,
      composer_source_id: workCandidate.composerSourceId ?? null,
      composer_display_name: workCandidate.composerDisplayName ?? null,
    },
    warnings: [],
    extraMetadata: {
      seed_strategy: "targeted_missing_work_composer",
      seed_offset: offset,
      derived_from_work_source_id: workCandidate.sourceIdentity.sourceId,
      derived_from_work_title: workCandidate.title,
      composer_source_id: workCandidate.composerSourceId ?? null,
      composer_display_name: workCandidate.composerDisplayName ?? null,
    },
    displayName,
    firstName,
    lastName,
  };
}

function isMissingResolvedComposer(result: CandidatePersistResult): boolean {
  return (
    result.entityKind === "work" &&
    result.outcome === "failed_parse" &&
    result.issues.some((item) => item.code === "missing_resolved_composer_id")
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const adapter = ingestAdapterRegistry.imslp;

  if (!adapter) {
    throw new Error("Missing IMSLP adapter.");
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

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

  const job = buildSyntheticJob(args);
  const missingCandidates: WorkCandidate[] = [];

  for (const candidate of parsed.candidates) {
    if (candidate.entityKind !== "work") {
      continue;
    }

    const result = await processIngestCandidate({
      supabase,
      candidate,
      job,
      actorUserId: args.createdBy,
      dryRun: true,
    });

    if (isMissingResolvedComposer(result)) {
      missingCandidates.push(candidate);
    }
  }

  const uniqueComposerCandidates = new Map<string, ComposerCandidate>();
  for (const candidate of missingCandidates) {
    const composerCandidate = makeComposerCandidate(candidate, args.offset);
    if (!composerCandidate) {
      continue;
    }

    uniqueComposerCandidates.set(composerCandidate.sourceIdentity.sourceId, composerCandidate);
  }

  const results = {
    created: 0,
    updated: 0,
    flagged: 0,
    failed: 0,
  };

  for (const candidate of uniqueComposerCandidates.values()) {
    const persisted = await persistComposerCandidate({
      supabase,
      candidate,
      options: {
        actorUserId: args.createdBy,
        onSourceMatch: "update",
        flagDuplicates: true,
        importSource: "imslp",
      },
    });

    if (persisted.outcome === "created") {
      results.created += 1;
    } else if (persisted.outcome === "updated") {
      results.updated += 1;
    } else if (persisted.outcome === "flagged_duplicate") {
      results.flagged += 1;
    } else {
      results.failed += 1;
    }
  }

  console.log(
    JSON.stringify(
      {
        offset: args.offset,
        batchSize: args.batchSize,
        failedWorkRows: missingCandidates.length,
        uniqueMissingComposers: uniqueComposerCandidates.size,
        seedResults: results,
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
