import type { IngestEntityKind, IngestIssue } from "@/lib/ingest/domain";
import type { IngestCandidate, SourceIdentity } from "@/lib/ingest/candidates";

export type IngestPersistOutcome =
  | "created"
  | "updated"
  | "skipped_existing_source_match"
  | "flagged_duplicate"
  | "failed_parse"
  | "failed_write";

export interface ResultContext {
  entityKind: IngestEntityKind;
  sourceIdentity?: Partial<SourceIdentity>;
  candidate?: IngestCandidate;
}

export interface BasePersistResult extends ResultContext {
  outcome: IngestPersistOutcome;
  issues: IngestIssue[];
}

export interface CreatedPersistResult extends BasePersistResult {
  outcome: "created";
  entityId: string;
}

export interface UpdatedPersistResult extends BasePersistResult {
  outcome: "updated";
  entityId: string;
}

export interface SkippedExistingSourceMatchResult extends BasePersistResult {
  outcome: "skipped_existing_source_match";
  entityId: string;
  matchedBy: "source_identity";
}

export interface FlaggedDuplicateResult extends BasePersistResult {
  outcome: "flagged_duplicate";
  duplicateEntityIds: string[];
  reviewFlagId?: string;
}

export interface FailedParseResult extends BasePersistResult {
  outcome: "failed_parse";
}

export interface FailedWriteResult extends BasePersistResult {
  outcome: "failed_write";
}

export type CandidatePersistResult =
  | CreatedPersistResult
  | UpdatedPersistResult
  | SkippedExistingSourceMatchResult
  | FlaggedDuplicateResult
  | FailedParseResult
  | FailedWriteResult;

export interface BatchItemResult {
  result: CandidatePersistResult;
}
