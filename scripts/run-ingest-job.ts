import { config } from "dotenv";
import { resolve } from "path";
import { pathToFileURL } from "url";

import { createClient } from "@supabase/supabase-js";

import { processIngestCandidate } from "@/app/api/admin/ingest/_shared";
import { ingestAdapterRegistry } from "@/lib/ingest/adapters";
import { createIngestJob } from "@/lib/ingest/jobs/create";
import { runIngestJobBatch } from "@/lib/ingest/jobs/run";

config({ path: resolve(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY ?? "";

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY.");
  process.exit(1);
}

type EntityKind = "composer" | "work";
type SourceEntityKind = "person" | "work";

export interface RunIngestJobCliArgs {
  source: string;
  entityKind: EntityKind;
  offset: number;
  batchSize: number;
  dryRun: boolean;
  createdBy: string;
  workerIdentity: string;
  sourceEntityKind: SourceEntityKind;
}

function readBoolean(value: string): boolean {
  return value === "true" || value === "1";
}

function parseArgs(argv: string[]): RunIngestJobCliArgs {
  const defaults: RunIngestJobCliArgs = {
    source: "imslp",
    entityKind: "work",
    offset: 0,
    batchSize: 100,
    dryRun: true,
    createdBy: "f2ed501c-74ad-4c2e-bb66-c97f5a6aa0ba",
    workerIdentity: "manual:script",
    sourceEntityKind: "work",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];

    switch (token) {
      case "--source":
        defaults.source = next ?? defaults.source;
        index += 1;
        break;
      case "--entity-kind":
        if (next === "composer" || next === "work") {
          defaults.entityKind = next;
        }
        index += 1;
        break;
      case "--offset":
        defaults.offset = Number.parseInt(next ?? String(defaults.offset), 10);
        index += 1;
        break;
      case "--batch-size":
        defaults.batchSize = Number.parseInt(next ?? String(defaults.batchSize), 10);
        index += 1;
        break;
      case "--dry-run":
        defaults.dryRun = readBoolean(next ?? String(defaults.dryRun));
        index += 1;
        break;
      case "--created-by":
        defaults.createdBy = next ?? defaults.createdBy;
        index += 1;
        break;
      case "--worker-identity":
        defaults.workerIdentity = next ?? defaults.workerIdentity;
        index += 1;
        break;
      case "--source-entity-kind":
        if (next === "person" || next === "work") {
          defaults.sourceEntityKind = next;
        }
        index += 1;
        break;
      default:
        break;
    }
  }

  return defaults;
}

export async function runIngestJob(
  args: RunIngestJobCliArgs,
) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const created = await createIngestJob({
    supabase,
    adapterRegistry: ingestAdapterRegistry,
    input: {
      source: args.source,
      entityKind: args.entityKind,
      mode: "manual",
      dryRun: args.dryRun,
      createdBy: args.createdBy,
      batchSize: args.batchSize,
      cursor: {
        version: 1,
        strategy: "offset",
        offset: args.offset,
        batchSize: args.batchSize,
        sort: "id",
        sourceEntityKind: args.sourceEntityKind,
      },
      options: {
        sourceEntityKind: args.sourceEntityKind,
      },
    },
  });

  if (!created.ok || !created.data) {
    return {
      ok: false as const,
      stage: "create_failed" as const,
      issues: created.issues,
    };
  }

  const executed = await runIngestJobBatch({
    supabase,
    adapterRegistry: ingestAdapterRegistry,
    jobId: created.data.id,
    access: {
      actorUserId: args.createdBy,
      canReadAll: true,
    },
    processCandidate: processIngestCandidate,
    workerIdentity: args.workerIdentity,
    defaultBatchSize: args.batchSize,
  });

  if (!executed.ok || !executed.data) {
    return {
      ok: false as const,
      stage: "run_failed" as const,
      jobId: created.data.id,
      issues: executed.issues,
    };
  }

  const job = executed.data.job;

  return {
    ok: true as const,
    stage: "ok" as const,
    jobId: job.id,
    status: job.status,
    processedCount: job.processedCount,
    createdCount: job.createdCount,
    updatedCount: job.updatedCount,
    flaggedCount: job.flaggedCount,
    failedCount: job.failedCount,
    skippedCount: job.skippedCount,
    warningCount: job.warningCount,
    cursor: job.cursor,
    errorSummary: job.errorSummary,
    warningSummary: job.warningSummary,
    resultSummary: job.resultSummary,
    itemResults: executed.data.itemResults,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await runIngestJob(args);
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) {
    process.exit(1);
  }
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
