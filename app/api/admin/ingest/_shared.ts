import { NextResponse } from "next/server";

import type { IngestIssue } from "@/lib/ingest/domain";
import type { IngestAdapterRegistry } from "@/lib/ingest/jobs";
import type { WorkCandidate } from "@/lib/ingest/candidates";
import type { CandidateProcessorArgs } from "@/lib/ingest/jobs/types";
import { persistComposerCandidate, persistWorkCandidate } from "@/lib/ingest/persist";
import { findSourceIdentityMatch } from "@/lib/ingest/persist/source-identity";
import { createServerSupabase } from "@/lib/supabase/server";
import type { AdminRole } from "@/lib/auth";

const ADMIN_ROLE_RANK: Record<AdminRole, number> = {
  none: 0,
  contributor: 1,
  admin: 2,
  super_admin: 3,
};

export interface AdminIngestRouteContext {
  supabase: Awaited<ReturnType<typeof createServerSupabase>>;
  userId: string;
  adminRole: Exclude<AdminRole, "none">;
}

export const ingestAdapterRegistry: IngestAdapterRegistry = {};

function issueStatusCode(issue: IngestIssue): number {
  switch (issue.code) {
    case "ingest_job_not_found":
      return 404;
    case "forbidden_ingest_job_access":
      return 403;
    case "claim_ingest_job_conflict":
    case "invalid_ingest_job_transition":
      return 409;
    default:
      return 400;
  }
}

export function jsonIssues(issues: IngestIssue[], fallbackStatus = 400) {
  const primary = issues[0];
  const status = primary ? issueStatusCode(primary) : fallbackStatus;

  return NextResponse.json(
    {
      error: {
        code: primary?.code ?? "request_failed",
        message: primary?.message ?? "Request failed.",
        issues,
      },
    },
    { status },
  );
}

export async function requireAdminIngestContext(
  minRole: "contributor" | "admin" = "contributor",
): Promise<AdminIngestRouteContext | NextResponse> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile, error } = await supabase
    .from("user_profile")
    .select("admin_role")
    .eq("user_id", user.id)
    .single();

  const adminRole = (profile?.admin_role ?? "none") as AdminRole;
  if (error || ADMIN_ROLE_RANK[adminRole] < ADMIN_ROLE_RANK[minRole]) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return {
    supabase,
    userId: user.id,
    adminRole: adminRole as Exclude<AdminRole, "none">,
  };
}

async function resolveWorkComposerId(
  candidate: WorkCandidate,
  args: CandidateProcessorArgs,
): Promise<string | null> {
  if (!candidate.composerSourceId?.trim()) {
    return null;
  }

  const match = await findSourceIdentityMatch(args.supabase, "composer", {
    source: candidate.sourceIdentity.source,
    sourceEntityKind: "person",
    sourceId: candidate.composerSourceId.trim(),
  });

  return match?.entityId ?? null;
}

export async function processIngestCandidate(args: CandidateProcessorArgs) {
  if (args.candidate.entityKind === "composer") {
    return persistComposerCandidate({
      supabase: args.supabase,
      candidate: args.candidate,
      options: {
        actorUserId: args.actorUserId,
        onSourceMatch: "update",
        flagDuplicates: true,
        importSource: args.job.source,
      },
    });
  }

  return persistWorkCandidate({
    supabase: args.supabase,
    candidate: args.candidate,
    options: {
      actorUserId: args.actorUserId,
      onSourceMatch: "update",
      flagDuplicates: true,
      importSource: args.job.source,
      resolveComposerId: (candidate) => resolveWorkComposerId(candidate, args),
    },
  });
}
