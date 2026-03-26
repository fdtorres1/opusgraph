import type {
  ParseBatchResult,
  SourceIngestAdapter,
  ValidateJobOptionsResult,
} from "@/lib/ingest/adapters/types";
import type {
  CandidateWarning,
  ComposerCandidate,
  WorkCandidate,
} from "@/lib/ingest/candidates";
import type { IngestIssue, JsonObject } from "@/lib/ingest/domain";

import {
  fetchImslpType1Batch,
  fetchImslpType2Batch,
  type ImslpListRecord,
} from "./client";
import {
  IMSLP_SOURCE_ENTITY_KIND_PERSON,
  IMSLP_SOURCE_ENTITY_KIND_WORK,
} from "./constants";
import { mapImslpComposerCandidate, mapImslpWorkCandidate } from "./mapper";
import { fetchImslpWorkPage } from "./page-client";
import { parseImslpType1Row, parseImslpType2Row } from "./parser";
import { extractImslpWorkFields } from "./work-fields";

export interface ImslpJobOptions extends JsonObject {
  sourceEntityKind:
    | typeof IMSLP_SOURCE_ENTITY_KIND_PERSON
    | typeof IMSLP_SOURCE_ENTITY_KIND_WORK;
}

const IMSLP_WORK_PAGE_FETCH_CONCURRENCY = 4;

function issue(
  code: string,
  message: string,
  severity: IngestIssue["severity"] = "error",
  metadata?: JsonObject,
): IngestIssue {
  return {
    code,
    message,
    severity,
    ...(metadata ? { metadata } : {}),
  };
}

function validateImslpJobOptions(
  input: JsonObject | undefined,
): ValidateJobOptionsResult<ImslpJobOptions> {
  const requestedSourceEntityKind = input?.sourceEntityKind;

  if (
    requestedSourceEntityKind != null &&
    requestedSourceEntityKind !== IMSLP_SOURCE_ENTITY_KIND_PERSON &&
    requestedSourceEntityKind !== IMSLP_SOURCE_ENTITY_KIND_WORK
  ) {
    return {
      ok: false,
      issues: [
        issue(
          "imslp_unsupported_source_entity_kind",
          "The IMSLP adapter only supports person or work source entity kinds.",
          "error",
          { sourceEntityKind: requestedSourceEntityKind },
        ),
      ],
    };
  }

  return {
    ok: true,
    options: {
      sourceEntityKind:
        requestedSourceEntityKind === IMSLP_SOURCE_ENTITY_KIND_WORK
          ? IMSLP_SOURCE_ENTITY_KIND_WORK
          : IMSLP_SOURCE_ENTITY_KIND_PERSON,
    },
    issues: [],
  };
}

function normalizeRowIssues(
  rowWarnings: CandidateWarning[],
  parsedCount: number,
  itemCount: number,
): IngestIssue[] {
  const issues: IngestIssue[] = [...rowWarnings];

  const skippedCount = itemCount - parsedCount;
  if (skippedCount > 0) {
    issues.push(
      issue(
        "imslp_type1_invalid_rows_skipped",
        "Some IMSLP type=1 rows could not be parsed and were skipped.",
        "warning",
        { skippedCount, itemCount },
      ),
    );
  }

  return issues;
}

async function parseImslpComposerBatch(
  items: ImslpListRecord[],
): Promise<ParseBatchResult> {
  const candidates: ComposerCandidate[] = [];
  const rowWarnings: CandidateWarning[] = [];
  let parsedCount = 0;

  for (const item of items) {
    const parsedRow = parseImslpType1Row(item);
    if (!parsedRow) {
      continue;
    }

    parsedCount += 1;
    if (parsedRow.classification !== "composer") {
      rowWarnings.push(...parsedRow.warnings);
      continue;
    }

    const candidate = mapImslpComposerCandidate(parsedRow);
    if (!candidate) {
      rowWarnings.push({
        code: "imslp_type1_composer_mapping_failed",
        message:
          "A composer-classified IMSLP row could not be mapped into a composer candidate.",
        severity: "warning",
        metadata: { listId: parsedRow.listId },
      });
      continue;
    }

    candidates.push(candidate);
  }

  return {
    candidates,
    issues: normalizeRowIssues(rowWarnings, parsedCount, items.length),
  };
}

async function parseImslpWorkBatch(
  items: ImslpListRecord[],
): Promise<ParseBatchResult> {
  const candidates: WorkCandidate[] = [];
  const issues: IngestIssue[] = [];
  const parsedRows = items
    .map((item) => parseImslpType2Row(item))
    .filter((row): row is NonNullable<typeof row> => row !== null);

  for (
    let startIndex = 0;
    startIndex < parsedRows.length;
    startIndex += IMSLP_WORK_PAGE_FETCH_CONCURRENCY
  ) {
    const batch = parsedRows.slice(
      startIndex,
      startIndex + IMSLP_WORK_PAGE_FETCH_CONCURRENCY,
    );
    const mappedBatch = await Promise.all(
      batch.map(async (row) => {
        const page = await fetchImslpWorkPage({ title: row.listId });
        const fields = extractImslpWorkFields(page.wikitext, row.canonicalTitle);
        return mapImslpWorkCandidate({
          row,
          page,
          fields,
        });
      }),
    );

    for (const mapped of mappedBatch) {
      issues.push(...mapped.issues);
      if (mapped.candidate) {
        candidates.push(mapped.candidate);
      }
    }
  }

  const skippedCount = items.length - parsedRows.length;
  if (skippedCount > 0) {
    issues.push(
      issue(
        "imslp_type2_invalid_rows_skipped",
        "Some IMSLP type=2 rows could not be parsed and were skipped.",
        "warning",
        { skippedCount, itemCount: items.length },
      ),
    );
  }

  return {
    candidates,
    issues,
  };
}

export const imslpAdapter: SourceIngestAdapter<
  ImslpJobOptions,
  ImslpListRecord
> = {
  source: "imslp",
  validateJobOptions: validateImslpJobOptions,
  async fetchBatch(args) {
    if (args.entityKind === "composer") {
      return fetchImslpType1Batch(args);
    }

    return fetchImslpType2Batch(args);
  },
  async parseBatch(args) {
    if (args.entityKind === "composer") {
      return parseImslpComposerBatch(args.items);
    }

    if (args.entityKind === "work") {
      return parseImslpWorkBatch(args.items);
    }

    return {
      candidates: [],
      issues: [
        issue(
          "imslp_unsupported_entity_kind",
          "The IMSLP adapter only supports composer or work ingestion jobs.",
          "error",
          { entityKind: args.entityKind },
        ),
      ],
    };
  },
};

export * from "./constants";
export * from "./client";
export * from "./parser";
export * from "./mapper";
export * from "./page-client";
export * from "./work-fields";
