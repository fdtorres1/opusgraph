import { config } from "dotenv";
import { resolve } from "path";
import { pathToFileURL } from "url";

import { createClient } from "@supabase/supabase-js";

config({ path: resolve(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY ?? "";

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY.");
  process.exit(1);
}

interface CliArgs {
  seed: string;
  works: number;
  composers: number;
  flags: number;
}

interface ComposerAuditRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  birth_year: number | null;
  death_year: number | null;
  status: string;
  external_ids: Record<string, unknown> | null;
}

interface WorkAuditRow {
  id: string;
  work_name: string;
  composer_id: string | null;
  instrumentation_text: string | null;
  duration_seconds: number | null;
  composition_year: number | null;
  status: string;
  external_ids: Record<string, unknown> | null;
  extra_metadata: Record<string, unknown> | null;
}

interface ReviewFlagAuditRow {
  id: string;
  entity_id: string | null;
  reason: string;
  status: string;
  details: Record<string, unknown> | null;
  created_at: string;
}

interface IdRow {
  id: string;
}

interface ReviewFlagEntityRow {
  entity_id: string | null;
}

function parseArgs(argv: string[]): CliArgs {
  const defaults: CliArgs = {
    seed: "imslp-audit",
    works: 5,
    composers: 3,
    flags: 5,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];

    switch (token) {
      case "--seed":
        defaults.seed = next ?? defaults.seed;
        index += 1;
        break;
      case "--works":
        defaults.works = Number.parseInt(next ?? String(defaults.works), 10);
        index += 1;
        break;
      case "--composers":
        defaults.composers = Number.parseInt(next ?? String(defaults.composers), 10);
        index += 1;
        break;
      case "--flags":
        defaults.flags = Number.parseInt(next ?? String(defaults.flags), 10);
        index += 1;
        break;
      default:
        break;
    }
  }

  return defaults;
}

function hashSeed(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function createRng(seed: string) {
  let state = hashSeed(seed) || 1;

  return function next() {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function sampleOffsets(total: number, size: number, seed: string): number[] {
  if (total <= 0 || size <= 0) {
    return [];
  }

  const rng = createRng(seed);
  const target = Math.min(total, size);
  const offsets = new Set<number>();

  while (offsets.size < target) {
    offsets.add(Math.floor(rng() * total));
  }

  return [...offsets].sort((left, right) => left - right);
}

async function fetchRowsAtOffsets<T>(
  fetchAtOffset: (offset: number) => Promise<T | null>,
  offsets: number[],
): Promise<Array<Awaited<T>>> {
  const rows: Array<Awaited<T> | null> = await Promise.all(
    offsets.map((offset) => fetchAtOffset(offset)),
  );
  return rows.filter((row): row is Awaited<T> => row != null);
}

function composerDisplayName(row: ComposerAuditRow) {
  const first = row.first_name?.trim() ?? "";
  const last = row.last_name?.trim() ?? "";
  return [first, last].filter(Boolean).join(" ");
}

function imslpExternalId(externalIds: Record<string, unknown> | null) {
  const imslp =
    externalIds &&
    typeof externalIds === "object" &&
    !Array.isArray(externalIds)
      ? (externalIds.imslp as Record<string, unknown> | undefined)
      : undefined;

  return imslp ?? null;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const [acceptedWorkIdsResult, composerCount, flagCount, flaggedWorkIdsResult] =
    await Promise.all([
    supabase
      .from("work")
      .select("id")
      .contains("external_ids", { imslp: {} })
      .contains("extra_metadata", {
        imslp: {
          orchestral_scope: {
            classification: "orchestral",
          },
        },
      }),
    supabase.from("composer").select("*", { count: "exact", head: true }).contains("external_ids", { imslp: {} }),
    supabase
      .from("review_flag")
      .select("*", { count: "exact", head: true })
      .eq("status", "open")
      .eq("reason", "orchestral_scope_review"),
    supabase
      .from("review_flag")
      .select("entity_id")
      .eq("status", "open")
      .eq("reason", "orchestral_scope_review")
      .eq("entity_type", "work"),
    ]);

  if (acceptedWorkIdsResult.error) {
    throw acceptedWorkIdsResult.error;
  }

  if (flaggedWorkIdsResult.error) {
    throw flaggedWorkIdsResult.error;
  }

  const flaggedWorkIds = new Set(
    ((flaggedWorkIdsResult.data ?? []) as ReviewFlagEntityRow[])
      .map((row) => row.entity_id)
      .filter((entityId): entityId is string => typeof entityId === "string"),
  );

  const acceptedWorkIds = ((acceptedWorkIdsResult.data ?? []) as IdRow[])
    .map((row) => row.id)
    .filter((id) => !flaggedWorkIds.has(id));

  const workOffsets = sampleOffsets(
    acceptedWorkIds.length,
    args.works,
    `${args.seed}:works`,
  );
  const composerOffsets = sampleOffsets(
    composerCount.count ?? 0,
    args.composers,
    `${args.seed}:composers`,
  );
  const flagOffsets = sampleOffsets(flagCount.count ?? 0, args.flags, `${args.seed}:flags`);

  const [works, composers, flags] = await Promise.all([
    fetchRowsAtOffsets<WorkAuditRow>(async (offset) => {
      const { data, error } = await supabase
        .from("work")
        .select("id, work_name, composer_id, instrumentation_text, duration_seconds, composition_year, status, external_ids, extra_metadata")
        .eq("id", acceptedWorkIds[offset] ?? "")
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data;
    }, workOffsets),
    fetchRowsAtOffsets<ComposerAuditRow>(async (offset) => {
      const { data, error } = await supabase
        .from("composer")
        .select("id, first_name, last_name, birth_year, death_year, status, external_ids")
        .contains("external_ids", { imslp: {} })
        .order("id", { ascending: true })
        .range(offset, offset)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data;
    }, composerOffsets),
    fetchRowsAtOffsets<ReviewFlagAuditRow>(async (offset) => {
      const { data, error } = await supabase
        .from("review_flag")
        .select("id, entity_id, reason, status, details, created_at")
        .eq("status", "open")
        .eq("reason", "orchestral_scope_review")
        .order("id", { ascending: true })
        .range(offset, offset)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data;
    }, flagOffsets),
  ]);

  const composerIds = [...new Set(works.map((row) => row.composer_id).filter(Boolean))] as string[];
  const flagWorkIds = [...new Set(flags.map((row) => row.entity_id).filter(Boolean))] as string[];

  const [workComposerRows, flaggedWorkRows] = await Promise.all([
    composerIds.length > 0
      ? supabase.from("composer").select("id, first_name, last_name").in("id", composerIds)
      : Promise.resolve({ data: [], error: null }),
    flagWorkIds.length > 0
      ? supabase
          .from("work")
          .select("id, work_name, instrumentation_text, status, external_ids")
          .in("id", flagWorkIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (workComposerRows.error) {
    throw workComposerRows.error;
  }

  if (flaggedWorkRows.error) {
    throw flaggedWorkRows.error;
  }

  const composerMap = new Map(
    (workComposerRows.data ?? []).map((row) => [
      row.id,
      [row.first_name?.trim() ?? "", row.last_name?.trim() ?? ""].filter(Boolean).join(" "),
    ]),
  );
  const flaggedWorkMap = new Map((flaggedWorkRows.data ?? []).map((row) => [row.id, row]));

  console.log(
    JSON.stringify(
      {
        seed: args.seed,
        protocol: {
          works: args.works,
          composers: args.composers,
          flags: args.flags,
        },
        counts: {
          acceptedImslpWorks: acceptedWorkIds.length,
          imslpComposers: composerCount.count ?? 0,
          openOrchestralScopeFlags: flagCount.count ?? 0,
        },
        sampledOffsets: {
          works: workOffsets,
          composers: composerOffsets,
          flags: flagOffsets,
        },
        works: works.map((row) => ({
          id: row.id,
          title: row.work_name,
          composer: row.composer_id ? composerMap.get(row.composer_id) ?? row.composer_id : null,
          compositionYear: row.composition_year,
          instrumentationText: row.instrumentation_text,
          durationSeconds: row.duration_seconds,
          status: row.status,
          classification: "orchestral",
          classificationReason:
            typeof (
              (
                row.extra_metadata?.imslp as
                  | { orchestral_scope?: { reason?: unknown } }
                  | undefined
              )?.orchestral_scope?.reason
            ) === "string"
              ? (
                  row.extra_metadata?.imslp as
                    | { orchestral_scope?: { reason?: string } }
                    | undefined
                )?.orchestral_scope?.reason ?? null
              : null,
          imslp: imslpExternalId(row.external_ids),
        })),
        composers: composers.map((row) => ({
          id: row.id,
          name: composerDisplayName(row),
          birthYear: row.birth_year,
          deathYear: row.death_year,
          status: row.status,
          imslp: imslpExternalId(row.external_ids),
        })),
        flags: flags.map((row) => {
          const flaggedWork = row.entity_id ? flaggedWorkMap.get(row.entity_id) : null;
          const details = row.details ?? {};

          return {
            id: row.id,
            entityId: row.entity_id,
            createdAt: row.created_at,
            reason: row.reason,
            status: row.status,
            title:
              flaggedWork?.work_name ??
              (typeof details.title === "string" ? details.title : null),
            instrumentationText:
              flaggedWork?.instrumentation_text ??
              (typeof details.instrumentation_text === "string"
                ? details.instrumentation_text
                : null),
            classification:
              typeof details.classification === "string"
                ? details.classification
                : null,
            classificationReason:
              typeof details.classification_reason === "string"
                ? details.classification_reason
                : null,
            sourceUrl:
              typeof details.source_url === "string" ? details.source_url : null,
            imslp: imslpExternalId(flaggedWork?.external_ids ?? null),
          };
        }),
      },
      null,
      2,
    ),
  );
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
