import { NextResponse } from "next/server";

import type { IngestIssue } from "@/lib/ingest/domain";
import type { ComposerCandidate, WorkCandidate } from "@/lib/ingest/candidates";
import type { CandidateProcessorArgs } from "@/lib/ingest/jobs/types";
import { parseDuration } from "@/lib/duration";
import type { CandidatePersistResult } from "@/lib/ingest/results";
import { assessImslpWorkOrchestralScope } from "@/lib/ingest/adapters/imslp/work-fields";
import { ORCHESTRAL_SCOPE_REVIEW_REASON } from "@/lib/ingest/quarantine";
import {
  assessCandidateDuplicates,
  persistComposerCandidate,
  persistWorkCandidate,
} from "@/lib/ingest/persist";
import { quarantineWorkEntity } from "@/lib/ingest/persist/support";
import { parseImslpCanonicalName } from "@/lib/ingest/adapters/imslp/parser";
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
  if (candidate.composerSourceId?.trim()) {
    const match = await findSourceIdentityMatch(args.supabase, "composer", {
      source: candidate.sourceIdentity.source,
      sourceEntityKind: "person",
      sourceId: candidate.composerSourceId.trim(),
    });

    if (match?.entityId) {
      return match.entityId;
    }
  }

  const composerDisplayName = candidate.composerDisplayName?.trim();
  if (!composerDisplayName) {
    return null;
  }

  const parsedName = parseImslpCanonicalName(composerDisplayName);
  const firstName = parsedName.firstName.trim();
  const lastName = parsedName.lastName.trim();

  if (!lastName) {
    return null;
  }

  let exactQuery = args.supabase
    .from("composer")
    .select("id")
    .eq("last_name", lastName)
    .limit(2);

  exactQuery = firstName
    ? exactQuery.eq("first_name", firstName)
    : exactQuery.eq("first_name", "");

  const { data: exactData, error: exactError } = await exactQuery;
  if (!exactError && exactData?.length === 1) {
    return exactData[0]?.id ?? null;
  }

  const { data: fuzzyData, error: fuzzyError } = await args.supabase.rpc(
    "find_duplicate_composers",
    {
      in_first: firstName,
      in_last: lastName,
      in_birth_year: null,
    },
  );

  if (
    fuzzyError ||
    !Array.isArray(fuzzyData) ||
    fuzzyData.length !== 1 ||
    typeof fuzzyData[0] !== "string"
  ) {
    return null;
  }

  return fuzzyData[0];
}

function dryRunEntityId(candidate: ComposerCandidate | WorkCandidate): string {
  return `dry-run:${candidate.entityKind}:${candidate.sourceIdentity.source}:${candidate.sourceIdentity.sourceId}`;
}

function buildWorkQuarantineDetails(candidate: WorkCandidate) {
  const orchestralScope = assessImslpWorkOrchestralScope(
    candidate.instrumentationText,
  );

  return {
    source: candidate.sourceIdentity.source,
    source_entity_kind: candidate.sourceIdentity.sourceEntityKind,
    source_id: candidate.sourceIdentity.sourceId,
    source_url: candidate.sourceIdentity.sourceUrl ?? null,
    canonical_title: candidate.sourceIdentity.canonicalTitle ?? null,
    title: candidate.title,
    composer_display_name: candidate.composerDisplayName ?? null,
    instrumentation_text: candidate.instrumentationText ?? null,
    classification: orchestralScope.classification,
    classification_reason: orchestralScope.reason,
    matched_signals: orchestralScope.matchedSignals,
    normalized_instrumentation_text:
      orchestralScope.normalizedInstrumentationText,
  };
}

function shouldQuarantineWorkCandidate(candidate: WorkCandidate): boolean {
  const scope = assessImslpWorkOrchestralScope(candidate.instrumentationText);
  return scope.classification !== "orchestral";
}

async function quarantinePersistedWork(
  args: CandidateProcessorArgs,
  result: CandidatePersistResult,
): Promise<CandidatePersistResult> {
  if (
    result.outcome !== "created" &&
    result.outcome !== "updated" &&
    result.outcome !== "skipped_existing_source_match"
  ) {
    return result;
  }

  const candidate = args.candidate as WorkCandidate;
  const details = buildWorkQuarantineDetails(candidate);
  const quarantined = await quarantineWorkEntity(
    args.supabase,
    result.entityId,
    args.actorUserId,
    ORCHESTRAL_SCOPE_REVIEW_REASON,
    details,
  );

  return {
    outcome: "quarantined",
    entityKind: "work",
    entityId: result.entityId,
    sourceIdentity: candidate.sourceIdentity,
    candidate,
    reviewFlagId: quarantined.reviewFlagId ?? undefined,
    quarantineReason: ORCHESTRAL_SCOPE_REVIEW_REASON,
    issues: [
      ...result.issues,
      {
        code: "work_quarantined_for_orchestral_scope_review",
        message:
          "This IMSLP work was quarantined because it is not positively classified as orchestral.",
        severity: "warning",
        metadata: details,
      },
    ],
  };
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

  if (shouldQuarantineWorkCandidate(candidate)) {
    const entityId = sourceMatch?.entityId ?? dryRunEntityId(candidate);
    const details = buildWorkQuarantineDetails(candidate);

    return {
      outcome: "quarantined",
      entityKind: "work",
      entityId,
      sourceIdentity: candidate.sourceIdentity,
      candidate,
      quarantineReason: ORCHESTRAL_SCOPE_REVIEW_REASON,
      issues: [
        ...duplicateAssessment.issues,
        {
          code: "work_would_be_quarantined_for_orchestral_scope_review",
          message:
            "This IMSLP work would be quarantined because it is not positively classified as orchestral.",
          severity: "warning",
          metadata: details,
        },
      ],
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

  const persistedWork = await persistWorkCandidate({
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

  if (!shouldQuarantineWorkCandidate(args.candidate as WorkCandidate)) {
    return persistedWork;
  }

  return quarantinePersistedWork(args, persistedWork);
}
