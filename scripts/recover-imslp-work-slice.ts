import { config } from "dotenv";
import { resolve } from "path";

import { runIngestJob } from "./run-ingest-job";
import { inspectImslpWorkSlice } from "./inspect-imslp-work-slice";
import { seedMissingWorkComposers } from "./seed-imslp-work-composers";

config({ path: resolve(process.cwd(), ".env.local") });

interface CliArgs {
  offset: number;
  batchSize: number;
  createdBy: string;
  runLive: boolean;
}

function readBoolean(value: string): boolean {
  return value === "true" || value === "1";
}

function parseArgs(argv: string[]): CliArgs {
  const defaults: CliArgs = {
    offset: 0,
    batchSize: 100,
    createdBy: "f2ed501c-74ad-4c2e-bb66-c97f5a6aa0ba",
    runLive: true,
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
      case "--run-live":
        defaults.runLive = readBoolean(next ?? String(defaults.runLive));
        index += 1;
        break;
      default:
        break;
    }
  }

  return defaults;
}

function hasMissingResolvedComposer(errorSummary: unknown): boolean {
  if (
    errorSummary == null ||
    typeof errorSummary !== "object" ||
    Array.isArray(errorSummary)
  ) {
    return false;
  }

  const countsByCode = (errorSummary as { countsByCode?: unknown }).countsByCode;
  if (
    countsByCode == null ||
    typeof countsByCode !== "object" ||
    Array.isArray(countsByCode)
  ) {
    return false;
  }

  return "missing_resolved_composer_id" in countsByCode;
}

function summarizeRunResult(result: Awaited<ReturnType<typeof runIngestJob>>) {
  if (!result.ok) {
    return {
      ok: result.ok,
      stage: result.stage,
      jobId: "jobId" in result ? result.jobId : undefined,
      issues: result.issues,
    };
  }

  return {
    ok: result.ok,
    stage: result.stage,
    jobId: result.jobId,
    status: result.status,
    processedCount: result.processedCount,
    createdCount: result.createdCount,
    updatedCount: result.updatedCount,
    flaggedCount: result.flaggedCount,
    failedCount: result.failedCount,
    skippedCount: result.skippedCount,
    warningCount: result.warningCount,
    cursor: result.cursor,
    errorSummary: result.errorSummary,
    warningSummary: result.warningSummary,
    resultSummary: result.resultSummary,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const initialDryRun = await runIngestJob({
    source: "imslp",
    entityKind: "work",
    offset: args.offset,
    batchSize: args.batchSize,
    dryRun: true,
    createdBy: args.createdBy,
    workerIdentity: `manual:recover-offset-${args.offset}-dry-run`,
    sourceEntityKind: "work",
  });

  if (!initialDryRun.ok) {
    console.log(
      JSON.stringify(
        {
          stage: "initial_dry_run_failed",
          result: initialDryRun,
        },
        null,
        2,
      ),
    );
    process.exit(1);
  }

  let seedResult: Awaited<ReturnType<typeof seedMissingWorkComposers>> | null = null;
  let replayDryRun: Awaited<ReturnType<typeof runIngestJob>> = initialDryRun;

  if (
    initialDryRun.failedCount > 0 &&
    hasMissingResolvedComposer(initialDryRun.errorSummary)
  ) {
    seedResult = await seedMissingWorkComposers({
      offset: args.offset,
      batchSize: args.batchSize,
      createdBy: args.createdBy,
    });

    replayDryRun = await runIngestJob({
      source: "imslp",
      entityKind: "work",
      offset: args.offset,
      batchSize: args.batchSize,
      dryRun: true,
      createdBy: args.createdBy,
      workerIdentity: `manual:recover-offset-${args.offset}-dry-run-replay`,
      sourceEntityKind: "work",
    });
  }

  if (!replayDryRun.ok) {
    console.log(
      JSON.stringify(
        {
          stage: "replay_dry_run_failed",
          initialDryRun,
          seedResult,
          replayDryRun,
        },
        null,
        2,
      ),
    );
    process.exit(1);
  }

  if (replayDryRun.failedCount > 0) {
    const inspection = await inspectImslpWorkSlice({
      offset: args.offset,
      batchSize: args.batchSize,
      createdBy: args.createdBy,
    });

    console.log(
      JSON.stringify(
        {
          stage: "replay_still_failing",
          initialDryRun: summarizeRunResult(initialDryRun),
          seedResult,
          replayDryRun: summarizeRunResult(replayDryRun),
          inspection,
        },
        null,
        2,
      ),
    );
    process.exit(1);
  }

  let liveRun: Awaited<ReturnType<typeof runIngestJob>> | null = null;
  if (args.runLive) {
    liveRun = await runIngestJob({
      source: "imslp",
      entityKind: "work",
      offset: args.offset,
      batchSize: args.batchSize,
      dryRun: false,
      createdBy: args.createdBy,
      workerIdentity: `manual:recover-offset-${args.offset}-live`,
      sourceEntityKind: "work",
    });

    if (!liveRun.ok) {
    console.log(
      JSON.stringify(
        {
          stage: "live_run_failed",
          initialDryRun: summarizeRunResult(initialDryRun),
          seedResult,
          replayDryRun: summarizeRunResult(replayDryRun),
          liveRun: summarizeRunResult(liveRun),
        },
        null,
        2,
        ),
      );
      process.exit(1);
    }
  }

  console.log(
    JSON.stringify(
      {
        stage: "ok",
        offset: args.offset,
        batchSize: args.batchSize,
        initialDryRun: summarizeRunResult(initialDryRun),
        seedResult,
        replayDryRun: summarizeRunResult(replayDryRun),
        liveRun: liveRun ? summarizeRunResult(liveRun) : null,
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
