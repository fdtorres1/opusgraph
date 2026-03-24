import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  IngestEntityKind,
  IngestIssue,
  IngestJobInput,
  IngestJobMode,
  JsonObject,
  SourceKey,
} from "@/lib/ingest/domain";
import { issue } from "@/lib/ingest/persist/support";
import type { IngestJobRecord } from "@/lib/ingest/jobs/transitions";

export type IngestJobSupabaseClient = SupabaseClient<any, "public", any>;

export interface CreateIngestJobSuccess {
  ok: true;
  job: IngestJobRecord;
  issues: IngestIssue[];
}

export interface CreateIngestJobFailure {
  ok: false;
  job: null;
  issues: IngestIssue[];
}

export type CreateIngestJobResult = CreateIngestJobSuccess | CreateIngestJobFailure;

export interface CreateIngestJobParams<TOptions extends JsonObject = JsonObject> {
  supabase: IngestJobSupabaseClient;
  input: IngestJobInput<TOptions>;
}

const VALID_ENTITY_KINDS: readonly IngestEntityKind[] = ["composer", "work"];
const VALID_JOB_MODES: readonly IngestJobMode[] = [
  "manual",
  "scheduled",
  "backfill",
  "retry",
];

function isPlainObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeSourceKey(source: SourceKey): string {
  return source.trim().toLowerCase();
}

function normalizePositiveInteger(
  value: number | undefined,
  code: string,
  label: string,
  issues: IngestIssue[],
): number | null {
  if (value == null) {
    return null;
  }

  if (!Number.isInteger(value) || value <= 0) {
    issues.push(issue(code, `${label} must be a positive integer.`));
    return null;
  }

  return value;
}

function normalizePriority(
  value: number | undefined,
  issues: IngestIssue[],
): number {
  if (value == null) {
    return 100;
  }

  if (!Number.isInteger(value) || value < 0) {
    issues.push(issue("invalid_job_priority", "Priority must be zero or greater."));
    return 100;
  }

  return value;
}

function validateCreateInput<TOptions extends JsonObject>(
  input: IngestJobInput<TOptions>,
): Array<IngestIssue> {
  const issues: IngestIssue[] = [];
  const source = normalizeSourceKey(input.source);

  if (!source) {
    issues.push(issue("missing_source", "Source is required."));
  }

  if (!VALID_ENTITY_KINDS.includes(input.entityKind)) {
    issues.push(
      issue(
        "invalid_entity_kind",
        "Entity kind must be either composer or work.",
      ),
    );
  }

  if (!VALID_JOB_MODES.includes(input.mode)) {
    issues.push(
      issue(
        "invalid_job_mode",
        "Job mode must be manual, scheduled, backfill, or retry.",
      ),
    );
  }

  if (!input.createdBy?.trim()) {
    issues.push(issue("missing_created_by", "createdBy is required."));
  }

  if (typeof input.dryRun !== "boolean") {
    issues.push(issue("invalid_dry_run", "dryRun must be a boolean."));
  }

  normalizePositiveInteger(
    input.batchSize,
    "invalid_batch_size",
    "batchSize",
    issues,
  );
  normalizePositiveInteger(
    input.limitCount,
    "invalid_limit_count",
    "limitCount",
    issues,
  );
  normalizePriority(input.priority, issues);

  if (input.options != null && !isPlainObject(input.options)) {
    issues.push(issue("invalid_options", "options must be a JSON object."));
  }

  if (input.cursor != null && !isPlainObject(input.cursor)) {
    issues.push(issue("invalid_cursor", "cursor must be a JSON object or null."));
  }

  return issues;
}

export async function createIngestJob<TOptions extends JsonObject = JsonObject>({
  supabase,
  input,
}: CreateIngestJobParams<TOptions>): Promise<CreateIngestJobResult> {
  const issues = validateCreateInput(input);

  if (issues.length) {
    return {
      ok: false,
      job: null,
      issues,
    };
  }

  const source = normalizeSourceKey(input.source);
  const jobPayload = {
    source,
    entity_kind: input.entityKind,
    status: "pending" as const,
    mode: input.mode,
    priority: normalizePriority(input.priority, []),
    dry_run: input.dryRun,
    cursor: input.cursor ?? null,
    options: (input.options ?? {}) as JsonObject,
    batch_size: input.batchSize ?? null,
    limit_count: input.limitCount ?? null,
    created_by: input.createdBy.trim(),
  };

  const { data, error } = await supabase
    .from("source_ingest_job")
    .insert(jobPayload)
    .select("*")
    .single();

  if (error || !data) {
    return {
      ok: false,
      job: null,
      issues: [
        issue(
          "ingest_job_create_failed",
          error?.message ?? "Failed to create ingest job.",
        ),
      ],
    };
  }

  return {
    ok: true,
    job: data as IngestJobRecord,
    issues: [],
  };
}
