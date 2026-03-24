import type { IngestCandidate } from "@/lib/ingest/candidates";
import type {
  IngestExecutionSummary,
  IngestIssue,
  IngestJobStatus,
  JsonObject,
} from "@/lib/ingest/domain";
import type { CandidatePersistResult } from "@/lib/ingest/results";

import { loadIngestJob } from "@/lib/ingest/jobs/load";
import { assertIngestJobTransition } from "@/lib/ingest/jobs/transitions";
import type {
  IngestJobRecord,
  RunIngestJobBatchInput,
  RunIngestJobBatchOutput,
  ServiceResult,
} from "@/lib/ingest/jobs/types";
import {
  SOURCE_INGEST_JOB_SELECT,
  mapIngestJobRow,
  summarizeIssues,
} from "@/lib/ingest/jobs/types";

function issue(
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

function getOutcomeCounts(result: CandidatePersistResult) {
  return {
    processedCount: 1,
    createdCount: result.outcome === "created" ? 1 : 0,
    updatedCount: result.outcome === "updated" ? 1 : 0,
    flaggedCount: result.outcome === "flagged_duplicate" ? 1 : 0,
    failedCount:
      result.outcome === "failed_parse" || result.outcome === "failed_write" ? 1 : 0,
    skippedCount: result.outcome === "skipped_existing_source_match" ? 1 : 0,
    warningCount: result.issues.filter((item) => item.severity === "warning").length,
  };
}

function candidateWarningCount(candidate: IngestCandidate): number {
  return candidate.warnings.filter((warning) => warning.severity === "warning").length;
}

function summarizeBatchResult(
  job: IngestJobRecord,
  itemResults: CandidatePersistResult[],
  batchIssues: IngestIssue[],
  nextCursor: IngestJobRecord["cursor"],
): IngestExecutionSummary {
  const deltas = itemResults.reduce(
    (acc, result) => {
      const counts = getOutcomeCounts(result);
      acc.processedCount += counts.processedCount;
      acc.createdCount += counts.createdCount;
      acc.updatedCount += counts.updatedCount;
      acc.flaggedCount += counts.flaggedCount;
      acc.failedCount += counts.failedCount;
      acc.skippedCount += counts.skippedCount;
      acc.warningCount += counts.warningCount;
      return acc;
    },
    {
      processedCount: 0,
      createdCount: 0,
      updatedCount: 0,
      flaggedCount: 0,
      failedCount: 0,
      skippedCount: 0,
      warningCount: 0,
    },
  );

  const status: IngestJobStatus = nextCursor ? "paused" : "completed";
  const warningIssues = batchIssues.filter((item) => item.severity === "warning");
  const errorIssues = batchIssues.filter((item) => item.severity === "error");

  return {
    processedCount: job.processedCount + deltas.processedCount,
    createdCount: job.createdCount + deltas.createdCount,
    updatedCount: job.updatedCount + deltas.updatedCount,
    flaggedCount: job.flaggedCount + deltas.flaggedCount,
    failedCount: job.failedCount + deltas.failedCount,
    skippedCount: job.skippedCount + deltas.skippedCount,
    warningCount: job.warningCount + deltas.warningCount + warningIssues.length,
    status,
    nextCursor,
    errorSummary: summarizeIssues(errorIssues) ?? undefined,
    warningSummary: summarizeIssues(warningIssues) ?? undefined,
    resultSummary: {
      batchProcessedCount: deltas.processedCount,
      batchOutcomeCounts: {
        created: deltas.createdCount,
        updated: deltas.updatedCount,
        flagged: deltas.flaggedCount,
        failed: deltas.failedCount,
        skipped: deltas.skippedCount,
      },
      dryRun: job.dryRun,
    },
  };
}

async function updateJobState(
  input: RunIngestJobBatchInput,
  jobId: string,
  patch: Record<string, unknown>,
): Promise<ServiceResult<IngestJobRecord>> {
  const { data, error } = await input.supabase
    .from("source_ingest_job")
    .update(patch)
    .eq("id", jobId)
    .select(SOURCE_INGEST_JOB_SELECT)
    .single();

  if (error || !data) {
    return {
      ok: false,
      issues: [
        issue(
          "update_ingest_job_failed",
          error?.message ?? "Failed to update ingest job.",
          "error",
          { jobId },
        ),
      ],
    };
  }

  return {
    ok: true,
    data: mapIngestJobRow(data),
    issues: [],
  };
}

function getEffectiveBatchSize(job: IngestJobRecord, fallback: number): number {
  const configured = job.batchSize ?? fallback;
  if (job.limitCount == null) {
    return configured;
  }

  const remaining = job.limitCount - job.processedCount;
  return Math.max(0, Math.min(configured, remaining));
}

export async function runIngestJobBatch(
  input: RunIngestJobBatchInput,
): Promise<ServiceResult<RunIngestJobBatchOutput>> {
  const loaded = await loadIngestJob({
    supabase: input.supabase,
    jobId: input.jobId,
    access: {
      actorUserId: input.access.actorUserId,
      canReadAll: input.access.canReadAll,
    },
  });

  if (!loaded.ok || !loaded.data) {
    return {
      ok: false,
      issues: loaded.issues,
    };
  }

  const currentJob = loaded.data;
  const adapter = input.adapterRegistry[currentJob.source];
  if (!adapter) {
    return {
      ok: false,
      issues: [
        issue(
          "missing_ingest_adapter",
          `No ingest adapter is registered for source ${currentJob.source}.`,
          "error",
          { source: currentJob.source },
        ),
      ],
    };
  }

  const transition = assertIngestJobTransition(currentJob.status, "running");
  if (!transition.ok) {
    return {
      ok: false,
      issues: transition.issues,
    };
  }

  const now = new Date().toISOString();
  const started = await updateJobState(input, currentJob.id, {
    status: "running",
    started_at: currentJob.startedAt ?? now,
    claimed_by: input.workerIdentity ?? "manual:run",
    claimed_at: now,
    last_heartbeat_at: now,
    attempt_count: currentJob.attemptCount + 1,
    finished_at: null,
  });

  if (!started.ok || !started.data) {
    return {
      ok: false,
      issues: started.issues,
    };
  }

  const runningJob = started.data;
  const effectiveBatchSize = getEffectiveBatchSize(
    runningJob,
    input.defaultBatchSize ?? 100,
  );

  if (effectiveBatchSize <= 0) {
    const completed = await updateJobState(input, runningJob.id, {
      status: "completed",
      finished_at: now,
      claimed_by: null,
      claimed_at: null,
      last_heartbeat_at: now,
      result_summary: { reason: "limit_reached_before_batch" },
    });

    if (!completed.ok || !completed.data) {
      return {
        ok: false,
        issues: completed.issues,
      };
    }

    const summary: IngestExecutionSummary = {
      processedCount: completed.data.processedCount,
      createdCount: completed.data.createdCount,
      updatedCount: completed.data.updatedCount,
      flaggedCount: completed.data.flaggedCount,
      failedCount: completed.data.failedCount,
      skippedCount: completed.data.skippedCount,
      warningCount: completed.data.warningCount,
      status: completed.data.status,
      nextCursor: completed.data.cursor,
      errorSummary: completed.data.errorSummary ?? undefined,
      warningSummary: completed.data.warningSummary ?? undefined,
      resultSummary: completed.data.resultSummary ?? undefined,
    };

    return {
      ok: true,
      data: {
        job: completed.data,
        summary,
        itemResults: [],
      },
      issues: [],
    };
  }

  try {
    const fetched = await adapter.fetchBatch({
      entityKind: runningJob.entityKind,
      cursor: runningJob.cursor,
      batchSize: effectiveBatchSize,
      options: runningJob.options,
    });

    const parsed = await adapter.parseBatch({
      entityKind: runningJob.entityKind,
      items: fetched.items,
      options: runningJob.options,
    });

    const batchIssues: IngestIssue[] = [
      ...(fetched.issues ?? []),
      ...parsed.issues,
    ];

    const itemResults: CandidatePersistResult[] = [];

    for (const candidate of parsed.candidates) {
      if (candidate.entityKind !== runningJob.entityKind) {
        itemResults.push({
          outcome: "failed_parse",
          entityKind: candidate.entityKind,
          sourceIdentity: candidate.sourceIdentity,
          candidate,
          issues: [
            issue(
              "candidate_entity_kind_mismatch",
              `Candidate kind ${candidate.entityKind} does not match job kind ${runningJob.entityKind}.`,
            ),
          ],
        });
        continue;
      }

      batchIssues.push(
        ...candidate.warnings.map((warning) => ({
          ...warning,
          severity: warning.severity,
        })),
      );

      try {
        const result = await input.processCandidate({
          supabase: input.supabase,
          candidate,
          job: runningJob,
          actorUserId: input.access.actorUserId,
          dryRun: runningJob.dryRun,
        });

        itemResults.push(result);
        batchIssues.push(...result.issues);
      } catch (error) {
        itemResults.push({
          outcome: "failed_write",
          entityKind: candidate.entityKind,
          sourceIdentity: candidate.sourceIdentity,
          candidate,
          issues: [
            issue(
              "process_candidate_failed",
              error instanceof Error ? error.message : "Candidate processing failed.",
            ),
          ],
        });
      }
    }

    const summary = summarizeBatchResult(
      runningJob,
      itemResults,
      batchIssues,
      fetched.nextCursor ?? null,
    );
    const finishedAt = summary.status === "completed" ? new Date().toISOString() : null;

    const updated = await updateJobState(input, runningJob.id, {
      status: summary.status,
      cursor: summary.nextCursor ?? null,
      processed_count: summary.processedCount,
      created_count: summary.createdCount,
      updated_count: summary.updatedCount,
      flagged_count: summary.flaggedCount,
      failed_count: summary.failedCount,
      skipped_count: summary.skippedCount,
      warning_count: summary.warningCount,
      error_summary: summary.errorSummary ?? null,
      warning_summary: summary.warningSummary ?? null,
      result_summary: summary.resultSummary ?? null,
      last_heartbeat_at: new Date().toISOString(),
      claimed_by: null,
      claimed_at: null,
      finished_at: finishedAt,
    });

    if (!updated.ok || !updated.data) {
      return {
        ok: false,
        issues: updated.issues,
      };
    }

    return {
      ok: true,
      data: {
        job: updated.data,
        summary,
        itemResults,
      },
      issues: batchIssues,
    };
  } catch (error) {
    const failureIssue = issue(
      "run_ingest_job_batch_failed",
      error instanceof Error ? error.message : "Ingest job batch failed.",
    );

    const failed = await updateJobState(input, runningJob.id, {
      status: "failed",
      error_summary: summarizeIssues([failureIssue]),
      last_error_at: new Date().toISOString(),
      last_heartbeat_at: new Date().toISOString(),
      claimed_by: null,
      claimed_at: null,
      finished_at: new Date().toISOString(),
    });

    if (!failed.ok) {
      return {
        ok: false,
        issues: [failureIssue, ...failed.issues],
      };
    }

    return {
      ok: false,
      issues: [failureIssue],
    };
  }
}
