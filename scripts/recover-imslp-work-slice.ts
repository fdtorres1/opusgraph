import { config } from "dotenv";
import { resolve } from "path";

import { runIngestJob } from "./run-ingest-job";
import { inspectImslpWorkSlice } from "./inspect-imslp-work-slice";
import { seedMissingWorkComposers } from "./seed-imslp-work-composers";
import {
  auditImslpWorkCoverage,
  type AuditImslpWorkCoverageCliArgs,
} from "./audit-imslp-work-coverage";
import {
  qaImslpWorkSlice,
  type QaImslpWorkSliceResult,
} from "./qa-imslp-work-slice";

config({ path: resolve(process.cwd(), ".env.local") });

interface CliArgs {
  offset: number;
  batchSize: number;
  createdBy: string;
  runLive: boolean;
  requireQa: boolean;
  allowRiskyAccepted: boolean;
  requirePostLiveAudit: boolean;
  postLiveAuditAttempts: number;
  postLiveAuditDelayMs: number;
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
    requireQa: true,
    allowRiskyAccepted: false,
    requirePostLiveAudit: true,
    postLiveAuditAttempts: 3,
    postLiveAuditDelayMs: 5000,
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
      case "--require-qa":
        defaults.requireQa = readBoolean(next ?? String(defaults.requireQa));
        index += 1;
        break;
      case "--allow-risky-accepted":
        defaults.allowRiskyAccepted = readBoolean(
          next ?? String(defaults.allowRiskyAccepted),
        );
        index += 1;
        break;
      case "--require-post-live-audit":
        defaults.requirePostLiveAudit = readBoolean(
          next ?? String(defaults.requirePostLiveAudit),
        );
        index += 1;
        break;
      case "--post-live-audit-attempts":
        defaults.postLiveAuditAttempts = Number.parseInt(
          next ?? String(defaults.postLiveAuditAttempts),
          10,
        );
        index += 1;
        break;
      case "--post-live-audit-delay-ms":
        defaults.postLiveAuditDelayMs = Number.parseInt(
          next ?? String(defaults.postLiveAuditDelayMs),
          10,
        );
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

function summarizeQaResult(result: QaImslpWorkSliceResult) {
  return {
    offset: result.offset,
    batchSize: result.batchSize,
    gate: result.gate,
    summary: result.summary,
    riskyAcceptedSample: result.riskyAcceptedSample,
    failedSample: result.failedSample,
    duplicateSample: result.duplicateSample,
  };
}

function postLiveAuditGatePassed(
  result: Awaited<ReturnType<typeof auditImslpWorkCoverage>>,
): boolean {
  return (
    result.summary.uncoveredCount === 0 &&
    result.duplicateFlagHygiene.missingSourceIdentityCount === 0 &&
    result.duplicateFlagHygiene.duplicateSourceIdentityCount === 0
  );
}

function sleep(ms: number) {
  return new Promise((resolvePromise) => {
    setTimeout(resolvePromise, ms);
  });
}

async function runPostLiveAuditWithRetries(
  args: CliArgs,
): Promise<Awaited<ReturnType<typeof auditImslpWorkCoverage>>> {
  const auditArgs: AuditImslpWorkCoverageCliArgs = {
    offsetStart: args.offset,
    offsetEnd: args.offset,
    step: args.batchSize,
    batchSize: args.batchSize,
    createdBy: args.createdBy,
  };
  const attempts = Math.max(1, args.postLiveAuditAttempts);
  let latest: Awaited<ReturnType<typeof auditImslpWorkCoverage>> | null = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    logStage("post_live_audit_started", {
      offset: args.offset,
      batchSize: args.batchSize,
      attempt,
      attempts,
    });

    latest = await auditImslpWorkCoverage(auditArgs);

    logStage("post_live_audit_finished", {
      attempt,
      attempts,
      uncoveredCount: latest.summary.uncoveredCount,
      missingDuplicateSourceIdentityCount:
        latest.duplicateFlagHygiene.missingSourceIdentityCount,
      duplicateSourceIdentityCount:
        latest.duplicateFlagHygiene.duplicateSourceIdentityCount,
    });

    if (postLiveAuditGatePassed(latest) || attempt === attempts) {
      return latest;
    }

    await sleep(Math.max(0, args.postLiveAuditDelayMs));
  }

  if (!latest) {
    throw new Error("Post-live audit did not run.");
  }

  return latest;
}

function logStage(stage: string, data?: Record<string, unknown>) {
  console.error(
    JSON.stringify(
      {
        stage,
        at: new Date().toISOString(),
        ...(data ?? {}),
      },
      null,
      2,
    ),
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  logStage("initial_dry_run_started", {
    offset: args.offset,
    batchSize: args.batchSize,
  });

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

  logStage("initial_dry_run_finished", summarizeRunResult(initialDryRun));

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
    logStage("composer_seed_started", {
      offset: args.offset,
      batchSize: args.batchSize,
    });

    seedResult = await seedMissingWorkComposers({
      offset: args.offset,
      batchSize: args.batchSize,
      createdBy: args.createdBy,
    });

    logStage("composer_seed_finished", seedResult as unknown as Record<string, unknown>);
    logStage("replay_dry_run_started", {
      offset: args.offset,
      batchSize: args.batchSize,
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

    logStage("replay_dry_run_finished", summarizeRunResult(replayDryRun));
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

  let preLiveQa: QaImslpWorkSliceResult | null = null;
  if (args.runLive && args.requireQa) {
    logStage("pre_live_qa_started", {
      offset: args.offset,
      batchSize: args.batchSize,
      allowRiskyAccepted: args.allowRiskyAccepted,
    });

    preLiveQa = await qaImslpWorkSlice({
      offset: args.offset,
      batchSize: args.batchSize,
      createdBy: args.createdBy,
      allowRiskyAccepted: args.allowRiskyAccepted,
    });

    logStage("pre_live_qa_finished", {
      gate: preLiveQa.gate,
      summary: preLiveQa.summary,
    });

    if (!preLiveQa.gate.passed) {
      console.log(
        JSON.stringify(
          {
            stage: "pre_live_qa_gate_failed",
            initialDryRun: summarizeRunResult(initialDryRun),
            seedResult,
            replayDryRun: summarizeRunResult(replayDryRun),
            preLiveQa: summarizeQaResult(preLiveQa),
          },
          null,
          2,
        ),
      );
      process.exit(1);
    }
  }

  let liveRun: Awaited<ReturnType<typeof runIngestJob>> | null = null;
  let postLiveAudit: Awaited<ReturnType<typeof auditImslpWorkCoverage>> | null =
    null;
  if (args.runLive) {
    logStage("live_run_started", {
      offset: args.offset,
      batchSize: args.batchSize,
    });

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

    logStage("live_run_finished", summarizeRunResult(liveRun));

    if (!liveRun.ok) {
      console.log(
        JSON.stringify(
          {
            stage: "live_run_failed",
            note:
              "If the failure code is finalize_ingest_job_failed_after_writes, verify exact source-level coverage before rerunning this slice.",
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

    if (args.requirePostLiveAudit) {
      postLiveAudit = await runPostLiveAuditWithRetries(args);

      if (!postLiveAuditGatePassed(postLiveAudit)) {
        console.log(
          JSON.stringify(
            {
              stage: "post_live_audit_gate_failed",
              initialDryRun: summarizeRunResult(initialDryRun),
              seedResult,
              replayDryRun: summarizeRunResult(replayDryRun),
              preLiveQa: preLiveQa ? summarizeQaResult(preLiveQa) : null,
              liveRun: summarizeRunResult(liveRun),
              postLiveAudit,
            },
            null,
            2,
          ),
        );
        process.exit(1);
      }
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
        preLiveQa: preLiveQa ? summarizeQaResult(preLiveQa) : null,
        liveRun: liveRun ? summarizeRunResult(liveRun) : null,
        postLiveAudit,
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
