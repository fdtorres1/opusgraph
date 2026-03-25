import type { IngestIssue, JsonObject } from "@/lib/ingest/domain";

import type {
  IngestJobRecord,
  LoadIngestJobInput,
  ServiceResult,
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

function canAccessJob(job: IngestJobRecord, input: LoadIngestJobInput): boolean {
  return input.access.canReadAll === true || job.createdBy === input.access.actorUserId;
}

export async function loadIngestJob({
  supabase,
  jobId,
  access,
}: LoadIngestJobInput): Promise<ServiceResult<IngestJobRecord>> {
  const { data, error } = await supabase
    .from("source_ingest_job")
    .select(SOURCE_INGEST_JOB_SELECT)
    .eq("id", jobId)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      issues: [
        issue("load_ingest_job_failed", error.message, { jobId }),
      ],
    };
  }

  if (!data) {
    return {
      ok: false,
      issues: [
        issue("ingest_job_not_found", `Ingest job ${jobId} was not found.`, { jobId }),
      ],
    };
  }

  const job = mapIngestJobRow(data);
  if (!canAccessJob(job, { supabase, jobId, access })) {
    return {
      ok: false,
      issues: [
        issue("forbidden_ingest_job_access", "You cannot access this ingest job.", {
          jobId,
          actorUserId: access.actorUserId,
        }),
      ],
    };
  }

  return {
    ok: true,
    data: job,
    issues: [],
  };
}
