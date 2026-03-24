export type JsonPrimitive = boolean | number | string | null;

export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];

export type JsonObject = {
  [key: string]: JsonValue;
};

export type SourceKey = "imslp" | (string & {});

export type IngestEntityKind = "composer" | "work";

export type IngestJobStatus =
  | "pending"
  | "running"
  | "paused"
  | "completed"
  | "failed"
  | "canceled";

export type IngestJobMode = "manual" | "scheduled" | "backfill" | "retry";

export type IngestIssueSeverity = "info" | "warning" | "error";

export type IngestCursorStrategy = "offset" | (string & {});

export interface IngestIssue {
  code: string;
  message: string;
  severity: IngestIssueSeverity;
  path?: string;
  metadata?: JsonObject;
}

export interface IngestCursor {
  version: number;
  strategy: IngestCursorStrategy;
  offset?: number;
  batchSize?: number;
  sort?: string;
  sourceEntityKind?: string;
  state?: JsonObject;
}

export interface IngestJobInput<TOptions extends JsonObject = JsonObject> {
  source: SourceKey;
  entityKind: IngestEntityKind;
  mode: IngestJobMode;
  dryRun: boolean;
  createdBy: string;
  options?: TOptions;
  cursor?: IngestCursor | null;
  batchSize?: number;
  limitCount?: number;
  priority?: number;
}

export interface IngestExecutionSummary {
  processedCount: number;
  createdCount: number;
  updatedCount: number;
  flaggedCount: number;
  failedCount: number;
  skippedCount: number;
  warningCount: number;
  status?: IngestJobStatus;
  nextCursor?: IngestCursor | null;
  errorSummary?: JsonObject;
  warningSummary?: JsonObject;
  resultSummary?: JsonObject;
}

export interface IngestDryRunResult<TCandidate> {
  summary: IngestExecutionSummary;
  candidates: TCandidate[];
  issues: IngestIssue[];
  nextCursor?: IngestCursor | null;
}
