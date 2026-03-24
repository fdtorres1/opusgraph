import type {
  IngestEntityKind,
  IngestJobMode,
  IngestJobStatus,
  IngestIssue,
  JsonObject,
  SourceKey,
} from "@/lib/ingest/domain";

export interface IngestJobRecord {
  id: string;
  source: SourceKey;
  entity_kind: IngestEntityKind;
  status: IngestJobStatus;
  mode: IngestJobMode;
  priority: number;
  dry_run: boolean;
  cursor: JsonObject | null;
  options: JsonObject;
  batch_size: number | null;
  limit_count: number | null;
  processed_count: number;
  created_count: number;
  updated_count: number;
  flagged_count: number;
  failed_count: number;
  skipped_count: number;
  warning_count: number;
  error_summary: JsonObject | null;
  warning_summary: JsonObject | null;
  result_summary: JsonObject | null;
  attempt_count: number;
  last_error_at: string | null;
  next_retry_at: string | null;
  claimed_by: string | null;
  claimed_at: string | null;
  last_heartbeat_at: string | null;
  created_by: string;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}

const ALLOWED_TRANSITIONS: Record<IngestJobStatus, readonly IngestJobStatus[]> = {
  pending: ["running", "canceled"],
  running: ["paused", "completed", "failed", "canceled"],
  paused: ["running", "canceled"],
  completed: [],
  failed: [],
  canceled: [],
};

export class IngestJobTransitionError extends Error {
  readonly code = "invalid_ingest_job_transition";
  readonly from: IngestJobStatus;
  readonly to: IngestJobStatus;

  constructor(from: IngestJobStatus, to: IngestJobStatus) {
    super(`Invalid ingest job transition from ${from} to ${to}.`);
    this.name = "IngestJobTransitionError";
    this.from = from;
    this.to = to;
  }
}

export function canTransitionIngestJobStatus(
  from: IngestJobStatus,
  to: IngestJobStatus,
): boolean {
  if (from === to) {
    return false;
  }

  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertIngestJobStatusTransition(
  from: IngestJobStatus,
  to: IngestJobStatus,
): void {
  if (canTransitionIngestJobStatus(from, to)) {
    return;
  }

  throw new IngestJobTransitionError(from, to);
}

export function buildIngestJobTransitionIssue(
  from: IngestJobStatus,
  to: IngestJobStatus,
): IngestIssue {
  return {
    code: "invalid_ingest_job_transition",
    message: `Invalid ingest job transition from ${from} to ${to}.`,
    severity: "error",
    metadata: { from, to },
  };
}
