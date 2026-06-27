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
  batchId: string;
  limit: number;
  fromTier: PublicWorkTier;
  workId: string | null;
}

interface WorkRow {
  id: string;
  work_name: string | null;
  composer_id: string | null;
  instrumentation_text: string | null;
  duration_seconds: number | null;
  composition_year: number | null;
  public_tier: PublicWorkTier;
  field_confidence: Record<string, unknown> | null;
  evidence_summary: Record<string, unknown> | null;
  external_ids: Record<string, unknown> | null;
  extra_metadata: Record<string, unknown> | null;
  composer: { id: string; first_name: string | null; last_name: string | null } | null;
}

interface EvidenceRow {
  id: string;
  work_id: string;
  source: string;
  source_url: string;
  source_title: string | null;
  extracted_fields: Record<string, unknown> | null;
  confidence: string;
}

interface ReviewFlagRow {
  id: string;
  entity_id: string | null;
  reason: string;
  status: string;
  details: Record<string, unknown> | null;
}

function parseArgs(argv: string[]): CliArgs {
  const defaults: CliArgs = {
    batchId: `public-index-${new Date().toISOString().replace(/[:.]/g, "-")}`,
    limit: 50,
    fromTier: "draft",
    workId: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];

    switch (token) {
      case "--batch-id":
        defaults.batchId = next ?? defaults.batchId;
        index += 1;
        break;
      case "--limit":
        defaults.limit = Number.parseInt(next ?? String(defaults.limit), 10);
        index += 1;
        break;
      case "--from-tier":
        defaults.fromTier = normalizePublicWorkTier(next, defaults.fromTier);
        index += 1;
        break;
      case "--work-id":
        defaults.workId = next ?? null;
        index += 1;
        break;
      default:
        break;
    }
  }

  return defaults;
}

function composerDisplayName(work: WorkRow): string | null {
  const first = work.composer?.first_name?.trim() ?? "";
  const last = work.composer?.last_name?.trim() ?? "";
  const display = [first, last].filter(Boolean).join(" ");
  return display || null;
}

function durationText(seconds: number | null): string | null {
  if (seconds == null) {
    return null;
  }

  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}:${remaining.toString().padStart(2, "0")}`;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
    auth: { persistSession: false },
  });

  let query = supabase
    .from("work")
    .select(`
      id,
      work_name,
      composer_id,
      instrumentation_text,
      duration_seconds,
      composition_year,
      public_tier,
      field_confidence,
      evidence_summary,
      external_ids,
      extra_metadata,
      composer:composer_id(id, first_name, last_name)
    `)
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
      ? supabase
          .from("work_evidence")
          .select("id, work_id, source, source_url, source_title, extracted_fields, confidence")
          .in("work_id", workIds)
      : Promise.resolve({ data: [], error: null }),
    workIds.length > 0
      ? supabase
          .from("review_flag")
          .select("id, entity_id, reason, status, details")
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

  const evidenceByWork = new Map<string, EvidenceRow[]>();
  for (const row of (evidenceResult.data ?? []) as EvidenceRow[]) {
    evidenceByWork.set(row.work_id, [...(evidenceByWork.get(row.work_id) ?? []), row]);
  }

  const flagsByWork = new Map<string, ReviewFlagRow[]>();
  for (const row of (flagsResult.data ?? []) as ReviewFlagRow[]) {
    if (!row.entity_id) {
      continue;
    }
    flagsByWork.set(row.entity_id, [...(flagsByWork.get(row.entity_id) ?? []), row]);
  }

  const packets = works.map((work) => {
    const evidence = evidenceByWork.get(work.id) ?? [];
    const flags = flagsByWork.get(work.id) ?? [];

    return {
      schema_version: "public-index-packet-v1",
      packet_id: `${args.batchId}:${work.id}`,
      batch_id: args.batchId,
      candidate_id: work.id,
      source: "opusgraph",
      source_id: work.id,
      source_url: null,
      raw_title: work.work_name,
      normalized_title: work.work_name,
      composer_display_name: composerDisplayName(work),
      composer_id: work.composer_id,
      instrumentation_text: work.instrumentation_text,
      duration_text: durationText(work.duration_seconds),
      composition_year: work.composition_year,
      current_public_tier: work.public_tier,
      field_confidence: work.field_confidence ?? {},
      evidence: evidence.map((row) => ({
        evidence_id: row.id,
        source: row.source,
        url: row.source_url,
        title: row.source_title,
        confidence: row.confidence,
        extracted_fields: row.extracted_fields ?? {},
      })),
      parser_warnings: [],
      open_review_flags: flags.map((row) => ({
        id: row.id,
        reason: row.reason,
        details: row.details ?? {},
      })),
    };
  });

  console.log(
    JSON.stringify(
      {
        schema_version: "public-index-candidate-export-v1",
        batch_id: args.batchId,
        generated_at: new Date().toISOString(),
        from_tier: args.fromTier,
        count: packets.length,
        packets,
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
