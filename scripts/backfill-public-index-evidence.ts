import { config } from "dotenv";
import { resolve } from "path";
import { pathToFileURL } from "url";

import { createClient } from "@supabase/supabase-js";

import { normalizePublicWorkTier, type PublicWorkTier } from "@/lib/public-index/confidence";

config({ path: resolve(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY ?? "";

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY.");
  process.exit(1);
}

interface CliArgs {
  fromTier: PublicWorkTier;
  limit: number;
  workId: string | null;
  apply: boolean;
}

interface WorkRow {
  id: string;
  work_name: string | null;
  public_tier: PublicWorkTier;
  external_ids: Record<string, unknown> | null;
  extra_metadata: Record<string, unknown> | null;
}

interface EvidenceInsert {
  work_id: string;
  source: string;
  source_display_name: string;
  source_url: string;
  source_record_id: string | null;
  source_title: string | null;
  evidence_kind: string;
  supports_fields: string[];
  extracted_fields: Record<string, unknown>;
  confidence: string;
  source_terms_status: string;
  is_public: boolean;
  public_label: string | null;
  public_url: string | null;
  fetched_at: string | null;
}

interface CandidateReport {
  work_id: string;
  title: string | null;
  source_url: string | null;
  source_record_id: string | null;
  action: "insert" | "skip_existing" | "skip_missing_source";
  supports_fields: string[];
}

function parseBoolean(value: string | undefined): boolean {
  return value === "true" || value === "1";
}

function parseArgs(argv: string[]): CliArgs {
  const defaults: CliArgs = {
    fromTier: "draft",
    limit: 100,
    workId: null,
    apply: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];

    switch (token) {
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
      default:
        break;
    }
  }

  return defaults;
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

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    const text = readString(value);
    if (text) {
      return text;
    }
  }
  return null;
}

function supportsFields(extractedFields: Record<string, unknown> | null, imslp: Record<string, unknown>): string[] {
  const fields = new Set<string>(["external_ids"]);

  if (firstString(extractedFields?.title, extractedFields?.alternative_title, imslp.work_title, imslp.canonical_title)) {
    fields.add("title");
  }
  if (firstString(imslp.composer_name, imslp.parent_category)) {
    fields.add("composer");
  }
  if (firstString(extractedFields?.instrumentation_text)) {
    fields.add("instrumentation");
    fields.add("orchestral_scope");
  }
  if (firstString(extractedFields?.duration_text)) {
    fields.add("duration");
  }
  if (firstString(extractedFields?.composition_year_text)) {
    fields.add("composition_year");
  }
  if (fields.has("title") && fields.has("composer")) {
    fields.add("identity");
  }

  return Array.from(fields).sort();
}

function evidenceKey(workId: string, source: string, sourceRecordId: string | null, sourceUrl: string): string {
  return [workId, source, sourceRecordId ?? "", sourceUrl].join("::");
}

function buildEvidence(work: WorkRow): EvidenceInsert | null {
  const externalImslp = readRecord(readRecord(work.external_ids)?.imslp);
  const metadataImslp = readRecord(readRecord(work.extra_metadata)?.imslp);
  const imslp = { ...(externalImslp ?? {}), ...(metadataImslp ?? {}) };

  const sourceUrl = firstString(imslp.source_url, imslp.canonical_url);
  if (!sourceUrl) {
    return null;
  }

  const extractedFields = readRecord(imslp.extracted_fields);
  const page = readRecord(imslp.page);
  const sourceRecordId = firstString(imslp.source_id, imslp.page_id, imslp.list_id);
  const sourceTitle = firstString(imslp.canonical_title, imslp.work_title, page?.display_title, work.work_name);

  return {
    work_id: work.id,
    source: "imslp",
    source_display_name: "IMSLP",
    source_url: sourceUrl,
    source_record_id: sourceRecordId,
    source_title: sourceTitle,
    evidence_kind: "source_record",
    supports_fields: supportsFields(extractedFields, imslp),
    extracted_fields: {
      canonical_title: imslp.canonical_title ?? null,
      composer_name: imslp.composer_name ?? null,
      work_title: imslp.work_title ?? null,
      extracted_fields: extractedFields ?? {},
    },
    confidence: "probable",
    source_terms_status: "unverified",
    is_public: false,
    public_label: "IMSLP record",
    public_url: sourceUrl,
    fetched_at: readString(page?.touched),
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
    auth: { persistSession: false },
  });

  let query = supabase
    .from("work")
    .select("id, work_name, public_tier, external_ids, extra_metadata")
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

  const { data: existingRows, error: existingError } = workIds.length > 0
    ? await supabase
        .from("work_evidence")
        .select("work_id, source, source_record_id, source_url")
        .in("work_id", workIds)
        .eq("source", "imslp")
    : { data: [], error: null };

  if (existingError) {
    throw existingError;
  }

  const existingKeys = new Set(
    (existingRows ?? []).map((row) => {
      const record = row as {
        work_id: string;
        source: string;
        source_record_id: string | null;
        source_url: string;
      };
      return evidenceKey(record.work_id, record.source, record.source_record_id, record.source_url);
    }),
  );

  const inserts: EvidenceInsert[] = [];
  const reports: CandidateReport[] = [];

  for (const work of works) {
    const evidence = buildEvidence(work);
    if (!evidence) {
      reports.push({
        work_id: work.id,
        title: work.work_name,
        source_url: null,
        source_record_id: null,
        action: "skip_missing_source",
        supports_fields: [],
      });
      continue;
    }

    const key = evidenceKey(
      evidence.work_id,
      evidence.source,
      evidence.source_record_id,
      evidence.source_url,
    );
    if (existingKeys.has(key)) {
      reports.push({
        work_id: work.id,
        title: work.work_name,
        source_url: evidence.source_url,
        source_record_id: evidence.source_record_id,
        action: "skip_existing",
        supports_fields: evidence.supports_fields,
      });
      continue;
    }

    inserts.push(evidence);
    reports.push({
      work_id: work.id,
      title: work.work_name,
      source_url: evidence.source_url,
      source_record_id: evidence.source_record_id,
      action: "insert",
      supports_fields: evidence.supports_fields,
    });
  }

  if (args.apply && inserts.length > 0) {
    const { error: insertError } = await supabase.from("work_evidence").insert(inserts);
    if (insertError) {
      throw insertError;
    }
  }

  console.log(
    JSON.stringify(
      {
        schema_version: "public-index-evidence-backfill-report-v1",
        generated_at: new Date().toISOString(),
        source: "imslp",
        from_tier: args.fromTier,
        apply: args.apply,
        checked: works.length,
        insertable: inserts.length,
        skipped_existing: reports.filter((report) => report.action === "skip_existing").length,
        skipped_missing_source: reports.filter((report) => report.action === "skip_missing_source").length,
        reports,
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
