import type {
  ParseBatchResult,
  SourceIngestAdapter,
  ValidateJobOptionsResult,
} from "@/lib/ingest/adapters/types";
import type { CandidateWarning, ComposerCandidate } from "@/lib/ingest/candidates";
import type { IngestIssue, JsonObject } from "@/lib/ingest/domain";

import { fetchImslpType1Batch, type ImslpListRecord } from "./client";
import { IMSLP_SOURCE_ENTITY_KIND_PERSON } from "./constants";
import { mapImslpComposerCandidate } from "./mapper";
import { parseImslpType1Row } from "./parser";

export interface ImslpJobOptions extends JsonObject {
  sourceEntityKind: typeof IMSLP_SOURCE_ENTITY_KIND_PERSON;
}

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
    requestedSourceEntityKind !== IMSLP_SOURCE_ENTITY_KIND_PERSON
  ) {
    return {
      ok: false,
      issues: [
        issue(
          "imslp_unsupported_source_entity_kind",
          "The first IMSLP adapter slice only supports person rows.",
          "error",
          { sourceEntityKind: requestedSourceEntityKind },
        ),
      ],
    };
  }

  return {
    ok: true,
    options: {
      sourceEntityKind: IMSLP_SOURCE_ENTITY_KIND_PERSON,
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

export const imslpComposerAdapter: SourceIngestAdapter<
  ImslpJobOptions,
  ImslpListRecord
> = {
  source: "imslp",
  validateJobOptions: validateImslpJobOptions,
  fetchBatch: fetchImslpType1Batch,
  async parseBatch(args) {
    if (args.entityKind !== "composer") {
      return {
        candidates: [],
        issues: [
          issue(
            "imslp_unsupported_entity_kind",
            "The first IMSLP adapter slice only supports composer ingestion jobs.",
            "error",
            { entityKind: args.entityKind },
          ),
        ],
      };
    }

    return parseImslpComposerBatch(args.items);
  },
};

export * from "./constants";
export * from "./client";
export * from "./parser";
export * from "./mapper";
