import { config } from "dotenv";
import { resolve } from "path";
import { pathToFileURL } from "url";

import { createClient } from "@supabase/supabase-js";

import { assessImslpWorkOrchestralScope } from "@/lib/ingest/adapters/imslp/work-fields";
import {
  FIELD_CONFIDENCE_KEYS,
  normalizePublicWorkTier,
  type ConfidenceLevel,
  type FieldConfidence,
  type PublicWorkTier,
} from "@/lib/public-index/confidence";

config({ path: resolve(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY ?? "";

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY.");
  process.exit(1);
}

const PUBLIC_TARGET_TIERS = new Set<PublicWorkTier>(["indexed", "verified", "canonical"]);
const BLOCKING_FLAG_REASONS = new Set(["orchestral_scope_review", "possible_duplicate"]);
const AUTO_INDEX_SCOPE_REASONS = new Set([
  "explicit_orchestra_signal",
  "multi_family_orchestral_scoring",
]);
const AMBIGUOUS_ORCHESTRAL_PUBLICATION_PATTERNS: Array<[string, RegExp]> = [
  ["ambiguous_orchestra_question", /\borchestra(?:l)?\s*(?:\(\s*\?\s*\)|\?)/i],
  ["optional_orchestra_alternative", /(?:\bor\s+orchestra(?:l)?\b|\borchestra(?:l)?\s+or\b)/i],
  [
    "weak_orchestral_reference",
    /\b(?:orchestra(?:l)? accompaniment|version with orchestra(?:l)?|version with orchestra(?:l)? accompaniment|implying orchestra(?:l)? accompaniment|originally orchestra(?:l)?)\b/i,
  ],
];

interface CliArgs {
  targetTier: PublicWorkTier;
  fromTier: PublicWorkTier;
  limit: number;
  workId: string | null;
  apply: boolean;
  batchId: string;
  gateVersion: string;
  reviewerId: string | null;
}

interface WorkRow {
  id: string;
  work_name: string | null;
  composer_id: string | null;
  instrumentation_text: string | null;
  public_tier: PublicWorkTier;
  field_confidence: Partial<FieldConfidence> | null;
  extra_metadata: Record<string, unknown> | null;
}

interface EvidenceRow {
  id: string;
  work_id: string;
}

interface ReviewFlagRow {
  id: string;
  entity_id: string | null;
  reason: string;
}

interface GateResult {
  workId: string;
  title: string | null;
  fromTier: PublicWorkTier;
  toTier: PublicWorkTier;
  passed: boolean;
  reasons: string[];
  blockingIssues: string[];
  evidenceIds: string[];
  fieldConfidence: FieldConfidence;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseBoolean(value: string | undefined): boolean {
  return value === "true" || value === "1";
}

function parseArgs(argv: string[]): CliArgs {
  const defaults: CliArgs = {
    targetTier: "indexed",
    fromTier: "draft",
    limit: 50,
    workId: null,
    apply: false,
    batchId: `public-index-${new Date().toISOString().replace(/[:.]/g, "-")}`,
    gateVersion: "public-index-gate-v1",
    reviewerId: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];

    switch (token) {
      case "--tier":
        defaults.targetTier = normalizePublicWorkTier(next, defaults.targetTier);
        index += 1;
        break;
      case "--from-tier":
        defaults.fromTier = normalizePublicWorkTier(next, defaults.fromTier);
        index += 1;
        break;
      case "--limit":
        defaults.limit = Number.parseInt(next ?? String(defaults.limit), 10);
        index += 1;
        break;
      case "--work-id":
        defaults.workId = next ?? null;
        index += 1;
        break;
      case "--apply":
        defaults.apply = parseBoolean(next);
        index += 1;
        break;
      case "--batch-id":
        defaults.batchId = next ?? defaults.batchId;
        index += 1;
        break;
      case "--gate-version":
        defaults.gateVersion = next ?? defaults.gateVersion;
        index += 1;
        break;
      case "--reviewer-id":
        defaults.reviewerId = next ?? defaults.reviewerId;
        index += 1;
        break;
      default:
        break;
    }
  }

  return defaults;
}

function confidenceFromWork(work: WorkRow, evidenceIds: string[]): FieldConfidence {
  const existing = work.field_confidence ?? {};
  const base = Object.fromEntries(
    FIELD_CONFIDENCE_KEYS.map((key) => [key, existing[key] ?? "unknown"]),
  ) as FieldConfidence;

  if (work.work_name && work.composer_id && evidenceIds.length > 0) {
    base.identity = base.identity === "confirmed" ? "confirmed" : "probable";
    base.title = base.title === "confirmed" ? "confirmed" : "probable";
    base.composer = base.composer === "confirmed" ? "confirmed" : "probable";
    base.external_ids = base.external_ids === "confirmed" ? "confirmed" : "probable";
  }

  const imslpScope = (work.extra_metadata?.imslp as { orchestral_scope?: { classification?: unknown } } | undefined)
    ?.orchestral_scope;
  if (imslpScope?.classification === "orchestral" && base.orchestral_scope === "unknown") {
    base.orchestral_scope = "probable";
  }

  return base;
}

function isConfirmedOrProbable(value: ConfidenceLevel | undefined): boolean {
  return value === "confirmed" || value === "probable";
}

function getImslpMetadata(work: WorkRow): Record<string, unknown> | null {
  return readRecord(readRecord(work.extra_metadata)?.imslp);
}

function getPersistedImslpInstrumentationText(work: WorkRow): string | null {
  const direct = readString(work.instrumentation_text);
  if (direct) {
    return direct;
  }

  const extractedFields = readRecord(getImslpMetadata(work)?.extracted_fields);
  return readString(extractedFields?.instrumentation_text);
}

function getPersistedImslpScope(work: WorkRow): Record<string, unknown> | null {
  return readRecord(getImslpMetadata(work)?.orchestral_scope);
}

function indexedScopeBlockers(work: WorkRow): string[] {
  const imslpMetadata = getImslpMetadata(work);
  if (!imslpMetadata) {
    return [];
  }

  const blockers: string[] = [];
  const instrumentationText = getPersistedImslpInstrumentationText(work);
  const reassessment = assessImslpWorkOrchestralScope(instrumentationText);
  const persistedScope = getPersistedImslpScope(work);
  const persistedClassification = readString(persistedScope?.classification);

  if (persistedClassification && persistedClassification !== reassessment.classification) {
    blockers.push("imslp_orchestral_scope_classifier_drift");
  }

  if (reassessment.classification !== "orchestral") {
    blockers.push("imslp_orchestral_scope_not_orchestral");
  }

  if (!AUTO_INDEX_SCOPE_REASONS.has(reassessment.reason)) {
    blockers.push(`imslp_scope_reason_${reassessment.reason}`);
  }

  const normalized = reassessment.normalizedInstrumentationText ?? "";
  for (const [issue, pattern] of AMBIGUOUS_ORCHESTRAL_PUBLICATION_PATTERNS) {
    if (pattern.test(normalized)) {
      blockers.push(issue);
    }
  }

  return [...new Set(blockers)];
}

function evaluateGate(
  work: WorkRow,
  targetTier: PublicWorkTier,
  evidenceIds: string[],
  openFlags: ReviewFlagRow[],
): GateResult {
  const reasons: string[] = [];
  const blockingIssues: string[] = [];
  const fieldConfidence = confidenceFromWork(work, evidenceIds);

  if (!PUBLIC_TARGET_TIERS.has(targetTier)) {
    blockingIssues.push("target_tier_not_public");
  }
  if (!work.work_name?.trim()) {
    blockingIssues.push("missing_work_name");
  }
  if (!work.composer_id) {
    blockingIssues.push("missing_composer_id");
  }
  if (evidenceIds.length === 0) {
    blockingIssues.push("missing_evidence");
  }
  if (!isConfirmedOrProbable(fieldConfidence.identity)) {
    blockingIssues.push("identity_confidence_not_probable");
  }
  if (!isConfirmedOrProbable(fieldConfidence.orchestral_scope)) {
    blockingIssues.push("orchestral_scope_not_probable");
  }
  if (targetTier === "indexed") {
    blockingIssues.push(...indexedScopeBlockers(work));
  }

  for (const flag of openFlags) {
    if (BLOCKING_FLAG_REASONS.has(flag.reason)) {
      blockingIssues.push(`open_${flag.reason}`);
    }
  }

  if (targetTier === "verified" || targetTier === "canonical") {
    if (fieldConfidence.identity !== "confirmed") {
      blockingIssues.push("verified_requires_confirmed_identity");
    }
    if (evidenceIds.length < 2) {
      blockingIssues.push("verified_requires_two_evidence_rows");
    }
  }

  if (targetTier === "canonical") {
    for (const key of ["title", "composer", "orchestral_scope"] as const) {
      if (fieldConfidence[key] !== "confirmed") {
        blockingIssues.push(`canonical_requires_confirmed_${key}`);
      }
    }
    if (!isConfirmedOrProbable(fieldConfidence.instrumentation)) {
      blockingIssues.push("canonical_requires_probable_instrumentation");
    }
  }

  if (blockingIssues.length === 0) {
    reasons.push(`passes_${targetTier}_gate`);
  }

  return {
    workId: work.id,
    title: work.work_name,
    fromTier: work.public_tier,
    toTier: targetTier,
    passed: blockingIssues.length === 0,
    reasons,
    blockingIssues,
    evidenceIds,
    fieldConfidence,
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
    auth: { persistSession: false },
  });

  let query = supabase
    .from("work")
    .select("id, work_name, composer_id, instrumentation_text, public_tier, field_confidence, extra_metadata")
    .order("work_name", { ascending: true })
    .limit(args.limit);

  if (args.workId) {
    query = query.eq("id", args.workId);
  } else {
    query = query.eq("public_tier", args.fromTier);
  }

  const { data: workRows, error: workError } = await query;
  if (workError) {
    throw workError;
  }

  const works = (workRows ?? []) as unknown as WorkRow[];
  const workIds = works.map((work) => work.id);

  const [evidenceResult, flagsResult] = await Promise.all([
    workIds.length > 0
      ? supabase.from("work_evidence").select("id, work_id").in("work_id", workIds)
      : Promise.resolve({ data: [], error: null }),
    workIds.length > 0
      ? supabase
          .from("review_flag")
          .select("id, entity_id, reason")
          .eq("entity_type", "work")
          .eq("status", "open")
          .in("entity_id", workIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (evidenceResult.error) {
    throw evidenceResult.error;
  }
  if (flagsResult.error) {
    throw flagsResult.error;
  }

  const evidenceByWork = new Map<string, string[]>();
  for (const row of (evidenceResult.data ?? []) as EvidenceRow[]) {
    evidenceByWork.set(row.work_id, [...(evidenceByWork.get(row.work_id) ?? []), row.id]);
  }

  const flagsByWork = new Map<string, ReviewFlagRow[]>();
  for (const row of (flagsResult.data ?? []) as ReviewFlagRow[]) {
    if (!row.entity_id) {
      continue;
    }
    flagsByWork.set(row.entity_id, [...(flagsByWork.get(row.entity_id) ?? []), row]);
  }

  const results = works.map((work) =>
    evaluateGate(
      work,
      args.targetTier,
      evidenceByWork.get(work.id) ?? [],
      flagsByWork.get(work.id) ?? [],
    ),
  );

  if (args.apply) {
    for (const result of results.filter((row) => row.passed)) {
      const evidenceSummary = {
        schema_version: "public-index-evidence-summary-v1",
        gate_version: args.gateVersion,
        evidence_ids: result.evidenceIds,
        public_rationale: result.reasons.join("; "),
        blocking_issues: result.blockingIssues,
        reviewer_kind: "system",
      };

      const { error: updateError } = await supabase
        .from("work")
        .update({
          public_tier: result.toTier,
          field_confidence: result.fieldConfidence,
          evidence_summary: evidenceSummary,
          promoted_at: new Date().toISOString(),
          promotion_gate_version: args.gateVersion,
        })
        .eq("id", result.workId);

      if (updateError) {
        throw updateError;
      }

      const { error: decisionError } = await supabase
        .from("work_promotion_decision")
        .insert({
          work_id: result.workId,
          from_tier: result.fromTier,
          to_tier: result.toTier,
          gate_version: args.gateVersion,
          decision: result,
          evidence_ids: result.evidenceIds,
          batch_id: args.batchId,
          reviewer_kind: "system",
          reviewer_id: args.reviewerId,
        });

      if (decisionError) {
        throw decisionError;
      }
    }
  }

  console.log(
    JSON.stringify(
      {
        schema_version: "public-index-promotion-report-v1",
        batch_id: args.batchId,
        gate_version: args.gateVersion,
        apply: args.apply,
        target_tier: args.targetTier,
        checked: results.length,
        passed: results.filter((row) => row.passed).length,
        blocked: results.filter((row) => !row.passed).length,
        results,
      },
      null,
      2,
    ),
  );
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
