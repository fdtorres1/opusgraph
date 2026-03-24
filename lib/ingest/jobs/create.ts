import type { JsonObject, IngestIssue } from "@/lib/ingest/domain";

import type {
  CreateIngestJobInput,
  ServiceResult,
  IngestJobRecord,
} from "@/lib/ingest/jobs/types";
import { SOURCE_INGEST_JOB_SELECT, mapIngestJobRow } from "@/lib/ingest/jobs/types";

function issue(
  code: string,
  message: string,
  metadata?: JsonObject,
): IngestIssue {
  return {
    code,
    message,
    severity: "error",
    ...(metadata ? { metadata } : {}),
  };
}

export async function createIngestJob<TOptions extends JsonObject = JsonObject>({
  supabase,
  adapterRegistry,
  input,
}: CreateIngestJobInput<TOptions>): Promise<ServiceResult<IngestJobRecord>> {
  const issues: IngestIssue[] = [];
  const adapter = adapterRegistry[input.source];

  if (!adapter) {
    issues.push(
      issue(
        "unsupported_ingest_source",
        `No ingest adapter is registered for source ${input.source}.`,
        { source: input.source },
      ),
    );
  }

  if (input.source !== input.source.trim().toLowerCase()) {
    issues.push(
      issue("invalid_source", "source must be a lowercase stable key.", {
        source: input.source,
      }),
    );
  }

  if (!["composer", "work"].includes(input.entityKind)) {
    issues.push(
      issue("invalid_entity_kind", `Unsupported entity kind ${input.entityKind}.`, {
        entityKind: input.entityKind,
      }),
    );
  }

  if (!["manual", "scheduled", "backfill", "retry"].includes(input.mode)) {
    issues.push(
      issue("invalid_mode", `Unsupported job mode ${input.mode}.`, {
        mode: input.mode,
      }),
    );
  }

  if (!input.createdBy.trim()) {
    issues.push(
      issue("missing_created_by", "createdBy is required."),
    );
  }

  if (typeof input.dryRun !== "boolean") {
    issues.push(
      issue("invalid_dry_run", "dryRun must be a boolean."),
    );
  }

  if (input.limitCount != null && input.limitCount <= 0) {
    issues.push(
      issue("invalid_limit_count", "limitCount must be greater than zero.", {
        limitCount: input.limitCount,
      }),
    );
  }

  if (input.batchSize != null && input.batchSize <= 0) {
    issues.push(
      issue("invalid_batch_size", "batchSize must be greater than zero.", {
        batchSize: input.batchSize,
      }),
    );
  }

  if (input.priority != null && input.priority < 0) {
    issues.push(
      issue("invalid_priority", "priority must be nonnegative.", {
        priority: input.priority,
      }),
    );
  }

  if (
    input.cursor != null &&
    (typeof input.cursor !== "object" || Array.isArray(input.cursor))
  ) {
    issues.push(
      issue("invalid_cursor", "cursor must be an object when provided."),
    );
  }

  if (
    input.options != null &&
    (typeof input.options !== "object" || Array.isArray(input.options))
  ) {
    issues.push(
      issue("invalid_options", "options must be an object when provided."),
    );
  }

  let normalizedOptions: JsonObject = input.options ?? {};
  if (adapter) {
    const validated = await adapter.validateJobOptions(input.options);
    if (!validated.ok) {
      issues.push(...validated.issues);
    } else {
      normalizedOptions = validated.options ?? {};
    }
  }

  if (issues.length) {
    return {
      ok: false,
      issues,
    };
  }

  const { data, error } = await supabase
    .from("source_ingest_job")
    .insert({
      source: input.source,
      entity_kind: input.entityKind,
      status: "pending",
      mode: input.mode,
      priority: input.priority ?? 100,
      dry_run: input.dryRun,
      cursor: input.cursor ?? null,
      options: normalizedOptions,
      batch_size: input.batchSize ?? null,
      limit_count: input.limitCount ?? null,
      created_by: input.createdBy,
    })
    .select(SOURCE_INGEST_JOB_SELECT)
    .single();

  if (error || !data) {
    return {
      ok: false,
      issues: [
        issue(
          "create_ingest_job_failed",
          error?.message ?? "Failed to create ingest job.",
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
