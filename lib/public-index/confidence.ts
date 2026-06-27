export const WORK_PUBLIC_TIERS = [
  "draft",
  "quarantined",
  "indexed",
  "verified",
  "canonical",
] as const;

export type PublicWorkTier = (typeof WORK_PUBLIC_TIERS)[number];

export const PUBLICLY_VISIBLE_WORK_TIERS = [
  "indexed",
  "verified",
  "canonical",
] as const satisfies readonly PublicWorkTier[];

export const CONFIDENCE_LEVELS = [
  "confirmed",
  "probable",
  "inferred",
  "conflicting",
  "unknown",
  "not_applicable",
] as const;

export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];

export const FIELD_CONFIDENCE_KEYS = [
  "identity",
  "title",
  "composer",
  "orchestral_scope",
  "instrumentation",
  "duration",
  "composition_year",
  "publisher",
  "availability",
  "external_ids",
] as const;

export type FieldConfidenceKey = (typeof FIELD_CONFIDENCE_KEYS)[number];
export type FieldConfidence = Record<FieldConfidenceKey, ConfidenceLevel>;

export const WORK_TIER_LABELS: Record<PublicWorkTier, string> = {
  draft: "Draft",
  quarantined: "Quarantined",
  indexed: "Indexed",
  verified: "Verified",
  canonical: "Canonical",
};

export const WORK_TIER_DESCRIPTIONS: Record<PublicWorkTier, string> = {
  draft: "Internal only",
  quarantined: "Internal review only",
  indexed: "Public source-backed index record",
  verified: "Public with stronger source confirmation",
  canonical: "High-confidence public canonical record",
};

export function isPublicWorkTier(value: unknown): value is PublicWorkTier {
  return typeof value === "string" && WORK_PUBLIC_TIERS.includes(value as PublicWorkTier);
}

export function isPubliclyVisibleWorkTier(
  value: unknown,
): value is (typeof PUBLICLY_VISIBLE_WORK_TIERS)[number] {
  return (
    typeof value === "string" &&
    PUBLICLY_VISIBLE_WORK_TIERS.includes(value as (typeof PUBLICLY_VISIBLE_WORK_TIERS)[number])
  );
}

export function normalizePublicWorkTier(
  value: unknown,
  fallback: PublicWorkTier = "draft",
): PublicWorkTier {
  return isPublicWorkTier(value) ? value : fallback;
}

export function publicTierFromLegacyStatus(value: unknown): PublicWorkTier {
  return value === "published" ? "verified" : "draft";
}

export function legacyStatusFromPublicTier(value: PublicWorkTier): "draft" | "published" {
  return isPubliclyVisibleWorkTier(value) ? "published" : "draft";
}

export function validateFieldConfidence(value: unknown): value is FieldConfidence {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return FIELD_CONFIDENCE_KEYS.every(
    (key) =>
      typeof record[key] === "string" &&
      CONFIDENCE_LEVELS.includes(record[key] as ConfidenceLevel),
  );
}

export type EvidenceSummary = {
  schema_version: string;
  gate_version: string;
  evidence_ids: string[];
  public_rationale: string;
  blocking_issues: string[];
  reviewer_kind: "system" | "ai" | "human" | "mixed";
};

export function validateEvidenceSummary(value: unknown): value is EvidenceSummary {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.schema_version === "string" &&
    typeof record.gate_version === "string" &&
    Array.isArray(record.evidence_ids) &&
    record.evidence_ids.every((id) => typeof id === "string") &&
    typeof record.public_rationale === "string" &&
    Array.isArray(record.blocking_issues) &&
    record.blocking_issues.every((issue) => typeof issue === "string") &&
    ["system", "ai", "human", "mixed"].includes(String(record.reviewer_kind))
  );
}
