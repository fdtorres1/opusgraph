import { config } from "dotenv";
import { resolve } from "path";
import { pathToFileURL } from "url";

import { createClient } from "@supabase/supabase-js";

import { assessImslpWorkOrchestralScope } from "@/lib/ingest/adapters/imslp/work-fields";
import { ORCHESTRAL_SCOPE_REVIEW_REASON } from "@/lib/ingest/quarantine";
import { quarantineWorkEntity } from "@/lib/ingest/persist/support";

config({ path: resolve(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY ?? "";

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY.");
  process.exit(1);
}

interface CliArgs {
  createdBy: string;
  batchSize: number;
  limit: number | null;
  dryRun: boolean;
}

interface WorkRow {
  id: string;
  status: string | null;
  work_name: string | null;
  instrumentation_text: string | null;
  external_ids: Record<string, unknown> | null;
  extra_metadata: Record<string, unknown> | null;
}

function readBoolean(value: string): boolean {
  return value === "true" || value === "1";
}

function parseArgs(argv: string[]): CliArgs {
  const defaults: CliArgs = {
    createdBy: "f2ed501c-74ad-4c2e-bb66-c97f5a6aa0ba",
    batchSize: 200,
    limit: null,
    dryRun: true,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];

    switch (token) {
      case "--created-by":
        defaults.createdBy = next ?? defaults.createdBy;
        index += 1;
        break;
      case "--batch-size":
        defaults.batchSize = Number.parseInt(next ?? String(defaults.batchSize), 10);
        index += 1;
        break;
      case "--limit":
        defaults.limit = Number.parseInt(next ?? "0", 10);
        index += 1;
        break;
      case "--dry-run":
        defaults.dryRun = readBoolean(next ?? String(defaults.dryRun));
        index += 1;
        break;
      default:
        break;
    }
  }

  return defaults;
}

function getImslpBucket(
  row: WorkRow,
): Record<string, unknown> | null {
  const externalIds = row.external_ids;
  if (!externalIds || typeof externalIds !== "object" || Array.isArray(externalIds)) {
    return null;
  }

  const imslp = externalIds.imslp;
  return imslp && typeof imslp === "object" && !Array.isArray(imslp)
    ? (imslp as Record<string, unknown>)
    : null;
}

function getImslpExtraMetadata(
  row: WorkRow,
): Record<string, unknown> | null {
  const extraMetadata = row.extra_metadata;
  if (!extraMetadata || typeof extraMetadata !== "object" || Array.isArray(extraMetadata)) {
    return null;
  }

  const imslp = extraMetadata.imslp;
  return imslp && typeof imslp === "object" && !Array.isArray(imslp)
    ? (imslp as Record<string, unknown>)
    : null;
}

function getPersistedInstrumentationText(row: WorkRow): string | null {
  if (row.instrumentation_text?.trim()) {
    return row.instrumentation_text.trim();
  }

  const imslp = getImslpExtraMetadata(row);
  const extractedFields = imslp?.extracted_fields;
  if (!extractedFields || typeof extractedFields !== "object" || Array.isArray(extractedFields)) {
    return null;
  }

  const value = (extractedFields as Record<string, unknown>).instrumentation_text;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function buildQuarantineDetails(row: WorkRow) {
  const instrumentationText = getPersistedInstrumentationText(row);
  const assessment = assessImslpWorkOrchestralScope(instrumentationText);
  const imslpExternalIds = getImslpBucket(row);
  const imslpExtraMetadata = getImslpExtraMetadata(row);

  return {
    source: "imslp",
    backfill: true,
    title: row.work_name,
    instrumentation_text: instrumentationText,
    classification: assessment.classification,
    classification_reason: assessment.reason,
    matched_signals: assessment.matchedSignals,
    normalized_instrumentation_text: assessment.normalizedInstrumentationText,
    source_id:
      typeof imslpExternalIds?.source_id === "string"
        ? imslpExternalIds.source_id
        : null,
    source_url:
      typeof imslpExternalIds?.source_url === "string"
        ? imslpExternalIds.source_url
        : null,
    canonical_title:
      typeof imslpExtraMetadata?.canonical_title === "string"
        ? imslpExtraMetadata.canonical_title
        : null,
  };
}

function summarize(details: Array<{ classification: string }>) {
  return details.reduce<Record<string, number>>((acc, item) => {
    acc[item.classification] = (acc[item.classification] ?? 0) + 1;
    return acc;
  }, {});
}

export async function quarantineImslpWorkScope(args: CliArgs) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  let from = 0;
  let processed = 0;
  let quarantined = 0;
  const classified: Array<{ classification: string }> = [];

  while (true) {
    const to = from + args.batchSize - 1;
    const { data, error } = await supabase
      .from("work")
      .select("id, status, work_name, instrumentation_text, external_ids, extra_metadata")
      .contains("external_ids", { imslp: {} })
      .order("id", { ascending: true })
      .range(from, to);

    if (error) {
      throw error;
    }

    const rows = (data ?? []) as WorkRow[];
    if (!rows.length) {
      break;
    }

    for (const row of rows) {
      if (args.limit != null && processed >= args.limit) {
        return { processed, quarantined, classificationSummary: summarize(classified) };
      }

      processed += 1;
      const details = buildQuarantineDetails(row);
      classified.push({ classification: details.classification });

      if (details.classification === "orchestral") {
        continue;
      }

      quarantined += 1;
      if (!args.dryRun) {
        await quarantineWorkEntity(
          supabase,
          row.id,
          args.createdBy,
          ORCHESTRAL_SCOPE_REVIEW_REASON,
          details,
        );
      }
    }

    from += rows.length;
    if (rows.length < args.batchSize) {
      break;
    }
  }

  return {
    processed,
    quarantined,
    classificationSummary: summarize(classified),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await quarantineImslpWorkScope(args);
  console.log(JSON.stringify({ ...result, dryRun: args.dryRun }, null, 2));
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
