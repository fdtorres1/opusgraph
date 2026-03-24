import type {
  IngestCursor,
  IngestEntityKind,
  IngestIssue,
  JsonObject,
  SourceKey,
} from "@/lib/ingest/domain";
import type {
  CandidateRawPayload,
  IngestCandidate,
} from "@/lib/ingest/candidates";

export interface ValidateJobOptionsResult<TOptions extends JsonObject = JsonObject> {
  ok: boolean;
  options?: TOptions;
  issues: IngestIssue[];
}

export interface FetchBatchArgs<TOptions extends JsonObject = JsonObject> {
  entityKind: IngestEntityKind;
  cursor?: IngestCursor | null;
  batchSize?: number;
  options: TOptions;
}

export interface FetchBatchResult<TRawItem = CandidateRawPayload> {
  items: TRawItem[];
  nextCursor?: IngestCursor | null;
  issues?: IngestIssue[];
}

export interface ParseBatchArgs<
  TOptions extends JsonObject = JsonObject,
  TRawItem = CandidateRawPayload,
> {
  entityKind: IngestEntityKind;
  items: TRawItem[];
  options: TOptions;
}

export interface NormalizedCandidateBatch {
  candidates: IngestCandidate[];
  issues: IngestIssue[];
}

export type ParseBatchResult = NormalizedCandidateBatch;

export interface SourceIngestAdapter<
  TOptions extends JsonObject = JsonObject,
  TRawItem = CandidateRawPayload,
> {
  source: SourceKey;
  validateJobOptions(
    input: JsonObject | undefined,
  ): ValidateJobOptionsResult<TOptions> | Promise<ValidateJobOptionsResult<TOptions>>;
  fetchBatch(args: FetchBatchArgs<TOptions>): Promise<FetchBatchResult<TRawItem>>;
  parseBatch(args: ParseBatchArgs<TOptions, TRawItem>): Promise<ParseBatchResult>;
}
