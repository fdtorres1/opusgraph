import { config } from "dotenv";
import { resolve } from "path";
import { pathToFileURL } from "url";

import { createClient } from "@supabase/supabase-js";

import { processIngestCandidate } from "@/app/api/admin/ingest/_shared";
import { ingestAdapterRegistry } from "@/lib/ingest/adapters";
import { assessImslpWorkOrchestralScope } from "@/lib/ingest/adapters/imslp/work-fields";
import type { WorkCandidate } from "@/lib/ingest/candidates";
import type { JsonObject } from "@/lib/ingest/domain";
import type { IngestJobRecord } from "@/lib/ingest/jobs/types";
import type { CandidatePersistResult } from "@/lib/ingest/results";

config({ path: resolve(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY ?? "";

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY.");
  process.exit(1);
}

export interface QaImslpWorkSliceCliArgs {
  offset: number;
  batchSize: number;
  createdBy: string;
  allowRiskyAccepted: boolean;
}

interface QaIssueSummary {
  code: string;
  severity: string;
  message: string;
}

interface QaWorkRow {
  sourceId: string;
  sourceUrl: string | null;
  title: string;
  composerDisplayName: string | null;
  composerSourceId: string | null;
  instrumentationText: string | null;
  durationText: string | null;
  rawDurationText: string | null;
  compositionYear: number | null;
  compositionYearText: string | null;
  pageRedirectTitle: string | null;
  orchestralScope: {
    classification: string;
    reason: string;
    matchedSignals: string[];
    normalizedInstrumentationText: string | null;
  };
  dryRunOutcome: CandidatePersistResult["outcome"];
  issueCodes: string[];
  warnings: QaIssueSummary[];
  issues: QaIssueSummary[];
  duplicateEntityIds: string[];
  riskFlags: string[];
  isAcceptedWrite: boolean;
  isRiskyAcceptedWrite: boolean;
}

export interface QaImslpWorkSliceResult {
  offset: number;
  batchSize: number;
  gate: {
    passed: boolean;
    allowRiskyAccepted: boolean;
    failedCount: number;
    riskyAcceptedWriteCount: number;
    acceptedWriteCount: number;
  };
  summary: {
    candidateCount: number;
    outcomeCounts: Record<string, number>;
    acceptedWriteCount: number;
    riskyAcceptedWriteCount: number;
    failedCount: number;
    quarantineCount: number;
    duplicateCount: number;
    warningCount: number;
    riskFlagCounts: Record<string, number>;
  };
  rows: QaWorkRow[];
  riskyAcceptedSample: QaWorkRow[];
  failedSample: QaWorkRow[];
  duplicateSample: QaWorkRow[];
}

function readBoolean(value: string): boolean {
  return value === "true" || value === "1";
}

function parseArgs(argv: string[]): QaImslpWorkSliceCliArgs {
  const defaults: QaImslpWorkSliceCliArgs = {
    offset: 0,
    batchSize: 100,
    createdBy: "f2ed501c-74ad-4c2e-bb66-c97f5a6aa0ba",
    allowRiskyAccepted: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];

    switch (token) {
      case "--offset":
        defaults.offset = Number.parseInt(next ?? String(defaults.offset), 10);
        index += 1;
        break;
      case "--batch-size":
        defaults.batchSize = Number.parseInt(next ?? String(defaults.batchSize), 10);
        index += 1;
        break;
      case "--created-by":
        defaults.createdBy = next ?? defaults.createdBy;
        index += 1;
        break;
      case "--allow-risky-accepted":
        defaults.allowRiskyAccepted = readBoolean(
          next ?? String(defaults.allowRiskyAccepted),
        );
        index += 1;
        break;
      default:
        break;
    }
  }

  return defaults;
}

function buildSyntheticJob(args: QaImslpWorkSliceCliArgs): IngestJobRecord {
  const now = new Date().toISOString();

  return {
    id: `synthetic:qa-imslp-work:${args.offset}`,
    source: "imslp",
    entityKind: "work",
    status: "running",
    mode: "manual",
    priority: 100,
    dryRun: true,
    cursor: {
      version: 1,
      strategy: "offset",
      offset: args.offset,
      batchSize: args.batchSize,
      sort: "id",
      sourceEntityKind: "work",
    },
    options: {
      sourceEntityKind: "work",
    },
    batchSize: args.batchSize,
    limitCount: null,
    processedCount: 0,
    createdCount: 0,
    updatedCount: 0,
    flaggedCount: 0,
    failedCount: 0,
    skippedCount: 0,
    warningCount: 0,
    errorSummary: null,
    warningSummary: null,
    resultSummary: null,
    attemptCount: 1,
    lastErrorAt: null,
    nextRetryAt: null,
    claimedBy: "manual:qa-imslp-work-slice",
    claimedAt: now,
    lastHeartbeatAt: now,
    createdBy: args.createdBy,
    startedAt: now,
    finishedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

function readRecord(value: unknown): JsonObject | null {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as JsonObject;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function readExtractedFields(candidate: WorkCandidate): JsonObject | null {
  const metadata = readRecord(candidate.extraMetadata);
  return readRecord(metadata?.extracted_fields);
}

function readCompositionYearText(candidate: WorkCandidate): string | null {
  const fields = readExtractedFields(candidate);
  return readString(fields?.composition_year_text);
}

function readPageRedirectTitle(candidate: WorkCandidate): string | null {
  const metadata = readRecord(candidate.extraMetadata);
  const page = readRecord(metadata?.page);
  return readString(page?.redirect_title);
}

function readRawDurationText(candidate: WorkCandidate): string | null {
  const fields = readExtractedFields(candidate);
  const rawFields = readRecord(fields?.raw_fields);
  return readString(rawFields?.["Average Duration"]);
}

function summarizeIssues(
  issues: CandidatePersistResult["issues"],
): QaIssueSummary[] {
  return issues.map((issue) => ({
    code: issue.code,
    severity: issue.severity,
    message: issue.message,
  }));
}

function readDuplicateEntityIds(result: CandidatePersistResult): string[] {
  if (result.outcome !== "flagged_duplicate") {
    return [];
  }

  return result.duplicateEntityIds;
}

function isAcceptedWrite(outcome: CandidatePersistResult["outcome"]): boolean {
  return (
    outcome === "created" ||
    outcome === "updated" ||
    outcome === "skipped_existing_source_match"
  );
}

function riskFlagsForRow(args: {
  candidate: WorkCandidate;
  result: CandidatePersistResult;
  compositionYearText: string | null;
  rawDurationText: string | null;
  pageRedirectTitle: string | null;
}): string[] {
  const { candidate, result, compositionYearText, rawDurationText, pageRedirectTitle } =
    args;
  const scope = assessImslpWorkOrchestralScope(candidate.instrumentationText);
  const accepted = isAcceptedWrite(result.outcome);
  const flags: string[] = [];

  if (result.outcome === "failed_parse" || result.outcome === "failed_write") {
    flags.push("dry_run_failed");
  }

  if (result.outcome === "flagged_duplicate") {
    flags.push("duplicate_ambiguity");
  }

  if (!candidate.instrumentationText?.trim()) {
    flags.push("missing_instrumentation");
  }

  if (scope.classification === "unknown") {
    flags.push("unknown_orchestral_scope");
  }

  if (scope.reason === "ambiguous_orchestral_reference_only") {
    flags.push("ambiguous_orchestral_reference");
  }

  if (compositionYearText && candidate.compositionYear == null) {
    flags.push("ambiguous_or_unparsed_year");
  }

  if (
    rawDurationText &&
    candidate.durationText &&
    rawDurationText.trim() !== candidate.durationText.trim()
  ) {
    flags.push("duration_normalized");
  }

  if (pageRedirectTitle) {
    flags.push("page_redirect");
  }

  if (!candidate.composerSourceId?.trim()) {
    flags.push("composer_source_id_missing");
  }

  if (accepted && scope.classification !== "orchestral") {
    flags.push("accepted_not_confirmed_orchestral");
  }

  if (accepted && candidate.warnings.length > 0) {
    flags.push("accepted_with_candidate_warnings");
  }

  if (accepted && result.issues.length > 0) {
    flags.push("accepted_with_processing_issues");
  }

  return flags;
}

function countBy(rows: string[]): Record<string, number> {
  return rows.reduce<Record<string, number>>((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

export async function qaImslpWorkSlice(
  args: QaImslpWorkSliceCliArgs,
): Promise<QaImslpWorkSliceResult> {
  const adapter = ingestAdapterRegistry.imslp;

  if (!adapter) {
    throw new Error("Missing IMSLP adapter.");
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const fetched = await adapter.fetchBatch({
    entityKind: "work",
    cursor: {
      version: 1,
      strategy: "offset",
      offset: args.offset,
      batchSize: args.batchSize,
      sort: "id",
      sourceEntityKind: "work",
    },
    batchSize: args.batchSize,
    options: {
      sourceEntityKind: "work",
    },
  });

  const parsed = await adapter.parseBatch({
    entityKind: "work",
    items: fetched.items,
    options: {
      sourceEntityKind: "work",
    },
  });

  const job = buildSyntheticJob(args);
  const rows: QaWorkRow[] = [];

  for (const candidate of parsed.candidates) {
    if (candidate.entityKind !== "work") {
      continue;
    }

    const result = await processIngestCandidate({
      supabase,
      candidate,
      job,
      actorUserId: args.createdBy,
      dryRun: true,
    });
    const scope = assessImslpWorkOrchestralScope(candidate.instrumentationText);
    const compositionYearText = readCompositionYearText(candidate);
    const rawDurationText = readRawDurationText(candidate);
    const pageRedirectTitle = readPageRedirectTitle(candidate);
    const riskFlags = riskFlagsForRow({
      candidate,
      result,
      compositionYearText,
      rawDurationText,
      pageRedirectTitle,
    });
    const accepted = isAcceptedWrite(result.outcome);
    const riskyAccepted = accepted && riskFlags.length > 0;

    rows.push({
      sourceId: candidate.sourceIdentity.sourceId,
      sourceUrl: candidate.sourceIdentity.sourceUrl ?? null,
      title: candidate.title,
      composerDisplayName: candidate.composerDisplayName ?? null,
      composerSourceId: candidate.composerSourceId ?? null,
      instrumentationText: candidate.instrumentationText ?? null,
      durationText: candidate.durationText ?? null,
      rawDurationText,
      compositionYear: candidate.compositionYear ?? null,
      compositionYearText,
      pageRedirectTitle,
      orchestralScope: {
        classification: scope.classification,
        reason: scope.reason,
        matchedSignals: scope.matchedSignals,
        normalizedInstrumentationText: scope.normalizedInstrumentationText,
      },
      dryRunOutcome: result.outcome,
      issueCodes: result.issues.map((issue) => issue.code),
      warnings: summarizeIssues(candidate.warnings),
      issues: summarizeIssues(result.issues),
      duplicateEntityIds: readDuplicateEntityIds(result),
      riskFlags,
      isAcceptedWrite: accepted,
      isRiskyAcceptedWrite: riskyAccepted,
    });
  }

  const outcomeCounts = countBy(rows.map((row) => row.dryRunOutcome));
  const riskFlagCounts = countBy(rows.flatMap((row) => row.riskFlags));
  const failedRows = rows.filter(
    (row) =>
      row.dryRunOutcome === "failed_parse" || row.dryRunOutcome === "failed_write",
  );
  const riskyAcceptedRows = rows.filter((row) => row.isRiskyAcceptedWrite);
  const gatePassed =
    failedRows.length === 0 &&
    (args.allowRiskyAccepted || riskyAcceptedRows.length === 0);

  return {
    offset: args.offset,
    batchSize: args.batchSize,
    gate: {
      passed: gatePassed,
      allowRiskyAccepted: args.allowRiskyAccepted,
      failedCount: failedRows.length,
      riskyAcceptedWriteCount: riskyAcceptedRows.length,
      acceptedWriteCount: rows.filter((row) => row.isAcceptedWrite).length,
    },
    summary: {
      candidateCount: rows.length,
      outcomeCounts,
      acceptedWriteCount: rows.filter((row) => row.isAcceptedWrite).length,
      riskyAcceptedWriteCount: riskyAcceptedRows.length,
      failedCount: failedRows.length,
      quarantineCount: rows.filter((row) => row.dryRunOutcome === "quarantined").length,
      duplicateCount: rows.filter((row) => row.dryRunOutcome === "flagged_duplicate")
        .length,
      warningCount: rows.reduce((total, row) => total + row.warnings.length, 0),
      riskFlagCounts,
    },
    rows,
    riskyAcceptedSample: riskyAcceptedRows.slice(0, 20),
    failedSample: failedRows.slice(0, 20),
    duplicateSample: rows
      .filter((row) => row.dryRunOutcome === "flagged_duplicate")
      .slice(0, 20),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await qaImslpWorkSlice(args);

  console.log(JSON.stringify(result, null, 2));
  if (!result.gate.passed) {
    process.exit(1);
  }
}

function isMainModule() {
  const entry = process.argv[1];
  return entry != null && import.meta.url === pathToFileURL(entry).href;
}

if (isMainModule()) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
