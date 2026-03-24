import type { IngestIssue, IngestJobStatus } from "@/lib/ingest/domain";

import type { ServiceResult } from "@/lib/ingest/jobs/types";

const TRANSITIONS: Record<IngestJobStatus, IngestJobStatus[]> = {
  pending: ["running", "canceled"],
  running: ["paused", "completed", "failed", "canceled"],
  paused: ["running", "canceled"],
  completed: [],
  failed: [],
  canceled: [],
};

function transitionIssue(
  from: IngestJobStatus,
  to: IngestJobStatus,
): IngestIssue {
  return {
    code: "invalid_job_transition",
    message: `Invalid ingest job transition from ${from} to ${to}.`,
    severity: "error",
    metadata: { from, to },
  };
}

export function canTransitionIngestJobStatus(
  from: IngestJobStatus,
  to: IngestJobStatus,
): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertIngestJobTransition(
  from: IngestJobStatus,
  to: IngestJobStatus,
): ServiceResult<{ from: IngestJobStatus; to: IngestJobStatus }> {
  if (!canTransitionIngestJobStatus(from, to)) {
    return {
      ok: false,
      issues: [transitionIssue(from, to)],
    };
  }

  return {
    ok: true,
    data: { from, to },
    issues: [],
  };
}
