import type { SupabaseClient } from "@supabase/supabase-js";

import type { SourceIngestAdapter } from "@/lib/ingest/adapters/types";
import type { IngestCandidate } from "@/lib/ingest/candidates";
import type {
  IngestCursor,
  IngestEntityKind,
  IngestExecutionSummary,
  IngestIssue,
  IngestJobInput,
  IngestJobMode,
  IngestJobStatus,
  JsonObject,
  SourceKey,
} from "@/lib/ingest/domain";
import type { CandidatePersistResult } from "@/lib/ingest/results";

export type IngestJobsSupabaseClient = SupabaseClient<any, "public", any>;

export interface IngestJobRecord {
  id: string;
  source: SourceKey;
  entityKind: IngestEntityKind;
  status: IngestJobStatus;
  mode: IngestJobMode;
  priority: number;
  dryRun: boolean;
  cursor: IngestCursor | null;
  options: JsonObject;
  batchSize: number | null;
  limitCount: number | null;
  processedCount: number;
  createdCount: number;
  updatedCount: number;
  flaggedCount: number;
  failedCount: number;
  skippedCount: number;
  warningCount: number;
  errorSummary: JsonObject | null;
  warningSummary: JsonObject | null;
  resultSummary: JsonObject | null;
  attemptCount: number;
  lastErrorAt: string | null;
  nextRetryAt: string | null;
  claimedBy: string | null;
  claimedAt: string | null;
  lastHeartbeatAt: string | null;
  createdBy: string;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IngestJobAccessContext {
  actorUserId: string;
  canReadAll?: boolean;
  canManageAll?: boolean;
}

export type IngestAdapterRegistry = Partial<
  Record<SourceKey, SourceIngestAdapter<JsonObject, any>>
>;

export interface CreateIngestJobInput<TOptions extends JsonObject = JsonObject> {
  supabase: IngestJobsSupabaseClient;
  adapterRegistry: IngestAdapterRegistry;
  input: IngestJobInput<TOptions>;
}

export interface LoadIngestJobInput {
  supabase: IngestJobsSupabaseClient;
  jobId: string;
  access: IngestJobAccessContext;
}

export interface CandidateProcessorArgs {
  supabase: IngestJobsSupabaseClient;
  candidate: IngestCandidate;
  job: IngestJobRecord;
  actorUserId: string;
  dryRun: boolean;
}

export type ProcessCandidate = (
  args: CandidateProcessorArgs,
) => Promise<CandidatePersistResult>;

export interface RunIngestJobBatchInput {
  supabase: IngestJobsSupabaseClient;
  adapterRegistry: IngestAdapterRegistry;
  jobId: string;
  access: IngestJobAccessContext;
  processCandidate: ProcessCandidate;
  workerIdentity?: string;
  defaultBatchSize?: number;
}

export interface ServiceResult<TData> {
  ok: boolean;
  data?: TData;
  issues: IngestIssue[];
}

export interface RunIngestJobBatchOutput {
  job: IngestJobRecord;
  summary: IngestExecutionSummary;
  itemResults: CandidatePersistResult[];
}

type IngestJobRow = {
  id: string;
  source: string;
  entity_kind: IngestEntityKind;
  status: IngestJobStatus;
  mode: IngestJobMode;
  priority: number;
  dry_run: boolean;
  cursor: IngestCursor | null;
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
};

export function mapIngestJobRow(row: IngestJobRow): IngestJobRecord {
  return {
    id: row.id,
    source: row.source,
    entityKind: row.entity_kind,
    status: row.status,
    mode: row.mode,
    priority: row.priority,
    dryRun: row.dry_run,
    cursor: row.cursor,
    options: row.options,
    batchSize: row.batch_size,
    limitCount: row.limit_count,
    processedCount: row.processed_count,
    createdCount: row.created_count,
    updatedCount: row.updated_count,
    flaggedCount: row.flagged_count,
    failedCount: row.failed_count,
    skippedCount: row.skipped_count,
    warningCount: row.warning_count,
    errorSummary: row.error_summary,
    warningSummary: row.warning_summary,
    resultSummary: row.result_summary,
    attemptCount: row.attempt_count,
    lastErrorAt: row.last_error_at,
    nextRetryAt: row.next_retry_at,
    claimedBy: row.claimed_by,
    claimedAt: row.claimed_at,
    lastHeartbeatAt: row.last_heartbeat_at,
    createdBy: row.created_by,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function summarizeIssues(issues: IngestIssue[]): JsonObject | null {
  if (!issues.length) {
    return null;
  }

  const countsByCode = issues.reduce<Record<string, number>>((acc, issue) => {
    acc[issue.code] = (acc[issue.code] ?? 0) + 1;
    return acc;
  }, {});

  return {
    total: issues.length,
    countsByCode,
  };
}

export const SOURCE_INGEST_JOB_SELECT = `
  id,
  source,
  entity_kind,
  status,
  mode,
  priority,
  dry_run,
  cursor,
  options,
  batch_size,
  limit_count,
  processed_count,
  created_count,
  updated_count,
  flagged_count,
  failed_count,
  skipped_count,
  warning_count,
  error_summary,
  warning_summary,
  result_summary,
  attempt_count,
  last_error_at,
  next_retry_at,
  claimed_by,
  claimed_at,
  last_heartbeat_at,
  created_by,
  started_at,
  finished_at,
  created_at,
  updated_at
`;
