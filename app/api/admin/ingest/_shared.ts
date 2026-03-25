import { NextResponse } from "next/server";

import type { IngestIssue } from "@/lib/ingest/domain";
import type { IngestAdapterRegistry } from "@/lib/ingest/jobs";
import type { ComposerCandidate, WorkCandidate } from "@/lib/ingest/candidates";
import type { CandidateProcessorArgs } from "@/lib/ingest/jobs/types";
import { parseDuration } from "@/lib/duration";
import type { CandidatePersistResult } from "@/lib/ingest/results";
import {
  assessCandidateDuplicates,
  persistComposerCandidate,
  persistWorkCandidate,
} from "@/lib/ingest/persist";
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

function normalizeAdminRole(value: unknown): AdminRole {
  return typeof value === "string" && value in ADMIN_ROLE_RANK
    ? (value as AdminRole)
    : "none";
}

function issueStatusCode(issue: IngestIssue): number {
  switch (issue.code) {
    case "ingest_job_not_found":
      return 404;
    case "forbidden_ingest_job_access":
      return 403;
    case "claim_ingest_job_conflict":
    case "invalid_job_transition":
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

  const adminRole = normalizeAdminRole(profile?.admin_role);
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

function dryRunEntityId(candidate: ComposerCandidate | WorkCandidate): string {
  return `dry-run:${candidate.entityKind}:${candidate.sourceIdentity.source}:${candidate.sourceIdentity.sourceId}`;
}

async function simulateComposerDryRun(
  args: CandidateProcessorArgs,
): Promise<CandidatePersistResult> {
  const candidate = args.candidate as ComposerCandidate;

  if (!candidate.firstName.trim() && !candidate.lastName.trim()) {
    return {
      outcome: "failed_parse",
      entityKind: "composer",
      candidate,
      sourceIdentity: candidate.sourceIdentity,
      issues: [
        {
          code: "missing_composer_name",
          message: "Composer persistence requires at least one of firstName or lastName.",
          severity: "error",
        },
      ],
    };
  }

  const sourceMatch = await findSourceIdentityMatch(
    args.supabase,
    "composer",
    candidate.sourceIdentity,
  );

  const duplicateAssessment = await assessCandidateDuplicates({
    candidate,
    importSource: args.job.source,
    callbacks: {
      resolveSourceMatchEntityId: () => sourceMatch?.entityId ?? null,
      findDuplicateComposers: async (input) => {
        const { data } = await args.supabase.rpc("find_duplicate_composers", input);
        return data ?? [];
      },
    },
  });

  if (duplicateAssessment.shouldFlagDuplicate) {
    return {
      outcome: "flagged_duplicate",
      entityKind: "composer",
      sourceIdentity: candidate.sourceIdentity,
      candidate,
      duplicateEntityIds: duplicateAssessment.duplicateEntityIds,
      issues: duplicateAssessment.issues,
    };
  }

  if (sourceMatch) {
    return {
      outcome: "updated",
      entityKind: "composer",
      entityId: sourceMatch.entityId,
      sourceIdentity: candidate.sourceIdentity,
      candidate,
      issues: duplicateAssessment.issues,
    };
  }

  return {
    outcome: "created",
    entityKind: "composer",
    entityId: dryRunEntityId(candidate),
    sourceIdentity: candidate.sourceIdentity,
    candidate,
    issues: duplicateAssessment.issues,
  };
}

async function simulateWorkDryRun(
  args: CandidateProcessorArgs,
): Promise<CandidatePersistResult> {
  const candidate = args.candidate as WorkCandidate;

  if (!candidate.title.trim()) {
    return {
      outcome: "failed_parse",
      entityKind: "work",
      candidate,
      sourceIdentity: candidate.sourceIdentity,
      issues: [
        {
          code: "missing_work_title",
          message: "Work persistence requires a title.",
          severity: "error",
        },
      ],
    };
  }

  const resolvedComposerId = await resolveWorkComposerId(candidate, args);
  if (!resolvedComposerId) {
    return {
      outcome: "failed_parse",
      entityKind: "work",
      candidate,
      sourceIdentity: candidate.sourceIdentity,
      issues: [
        {
          code: "missing_resolved_composer_id",
          message: "Work persistence requires a resolved composer id.",
          severity: "error",
        },
      ],
    };
  }

  if (candidate.durationText?.trim() && parseDuration(candidate.durationText.trim()) == null) {
    return {
      outcome: "failed_parse",
      entityKind: "work",
      candidate,
      sourceIdentity: candidate.sourceIdentity,
      issues: [
        {
          code: "invalid_duration_text",
          message: `Work duration could not be parsed: ${candidate.durationText}`,
          severity: "error",
        },
      ],
    };
  }

  const sourceMatch = await findSourceIdentityMatch(
    args.supabase,
    "work",
    candidate.sourceIdentity,
  );

  const duplicateAssessment = await assessCandidateDuplicates({
    candidate,
    importSource: args.job.source,
    resolvedComposerId,
    callbacks: {
      resolveSourceMatchEntityId: () => sourceMatch?.entityId ?? null,
      findDuplicateWorks: async (input) => {
        const { data } = await args.supabase.rpc("find_duplicate_works", input);
        return data ?? [];
      },
    },
  });

  if (duplicateAssessment.shouldFlagDuplicate) {
    return {
      outcome: "flagged_duplicate",
      entityKind: "work",
      sourceIdentity: candidate.sourceIdentity,
      candidate,
      duplicateEntityIds: duplicateAssessment.duplicateEntityIds,
      issues: duplicateAssessment.issues,
    };
  }

  if (sourceMatch) {
    return {
      outcome: "updated",
      entityKind: "work",
      entityId: sourceMatch.entityId,
      sourceIdentity: candidate.sourceIdentity,
      candidate,
      issues: duplicateAssessment.issues,
    };
  }

  return {
    outcome: "created",
    entityKind: "work",
    entityId: dryRunEntityId(candidate),
    sourceIdentity: candidate.sourceIdentity,
    candidate,
    issues: duplicateAssessment.issues,
  };
}

export async function processIngestCandidate(args: CandidateProcessorArgs) {
  if (args.dryRun) {
    if (args.candidate.entityKind === "composer") {
      return simulateComposerDryRun(args);
    }

    return simulateWorkDryRun(args);
  }

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
