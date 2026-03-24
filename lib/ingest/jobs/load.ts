import type { IngestIssue } from "@/lib/ingest/domain";
import { issue } from "@/lib/ingest/persist/support";
import type { IngestJobSupabaseClient } from "@/lib/ingest/jobs/create";
import type { IngestJobRecord } from "@/lib/ingest/jobs/transitions";

export interface LoadIngestJobParams {
  supabase: IngestJobSupabaseClient;
  jobId: string;
  actorUserId: string;
  canAccessAllJobs?: boolean;
}

export interface LoadIngestJobSuccess {
  ok: true;
  job: IngestJobRecord;
  issues: IngestIssue[];
}

export interface LoadIngestJobFailure {
  ok: false;
  job: null;
  issues: IngestIssue[];
}

export type LoadIngestJobResult = LoadIngestJobSuccess | LoadIngestJobFailure;

export async function loadIngestJob({
  supabase,
  jobId,
  actorUserId,
  canAccessAllJobs = false,
}: LoadIngestJobParams): Promise<LoadIngestJobResult> {
  if (!jobId.trim()) {
    return {
      ok: false,
      job: null,
      issues: [issue("missing_job_id", "Job id is required.")],
    };
  }

  if (!actorUserId.trim()) {
    return {
      ok: false,
      job: null,
      issues: [issue("missing_actor_user_id", "Actor user id is required.")],
    };
  }

  const { data, error } = await supabase
    .from("source_ingest_job")
    .select("*")
    .eq("id", jobId.trim())
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      job: null,
      issues: [
        issue(
          "ingest_job_load_failed",
          error.message ?? "Failed to load ingest job.",
        ),
      ],
    };
  }

  if (!data) {
    return {
      ok: false,
      job: null,
      issues: [issue("ingest_job_not_found", "Ingest job was not found.")],
    };
  }

  const job = data as IngestJobRecord;

  if (!canAccessAllJobs && job.created_by !== actorUserId.trim()) {
    return {
      ok: false,
      job: null,
      issues: [issue("ingest_job_forbidden", "You do not have access to this job.")],
    };
  }

  return {
    ok: true,
    job,
    issues: [],
  };
}
