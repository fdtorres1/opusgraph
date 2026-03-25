import type { FetchBatchArgs, FetchBatchResult } from "@/lib/ingest/adapters/types";
import type {
  IngestCursor,
  IngestEntityKind,
  IngestIssue,
  JsonObject,
  JsonValue,
} from "@/lib/ingest/domain";

import {
  IMSLP_API_ORIGIN,
  IMSLP_CURSOR_VERSION,
  IMSLP_DEFAULT_BATCH_SIZE,
  IMSLP_LIST_ACCOUNT,
  IMSLP_LIST_API_PATH,
  IMSLP_LIST_DISCLAIMER,
  IMSLP_LIST_RETFORMAT,
  IMSLP_LIST_SORT,
  IMSLP_LIST_TYPE_PEOPLE,
  IMSLP_LIST_TYPE_WORKS,
  IMSLP_TRANSPORT_ISSUE_CODES,
} from "./constants";

export interface ImslpListRecord extends JsonObject {
  id: string;
  type: string;
  parent: string;
  intvals: JsonValue;
  permlink: string;
}

interface ImslpListMeta {
  start?: number;
  limit?: number;
  sortby?: string;
  sortdirection?: string;
  moreresultsavailable?: boolean;
  timestamp?: number;
  apiversion?: number;
}

interface NormalizedImslpListResponse {
  items: ImslpListRecord[];
  meta: ImslpListMeta | null;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeCursor(
  cursor: IngestCursor | null | undefined,
): { offset: number; issues: IngestIssue[] } {
  if (!cursor) {
    return { offset: 0, issues: [] };
  }

  const issues: IngestIssue[] = [];

  if (cursor.strategy !== "offset") {
    issues.push(
      issue(
        IMSLP_TRANSPORT_ISSUE_CODES.invalidCursor,
        "IMSLP list transport expects an offset cursor strategy.",
        "warning",
        {
          strategy: cursor.strategy,
          offset: cursor.offset ?? null,
          batchSize: cursor.batchSize ?? null,
          sort: cursor.sort ?? null,
          sourceEntityKind: cursor.sourceEntityKind ?? null,
        },
      ),
    );
  }

  if (!isFiniteInteger(cursor.offset)) {
    if (cursor.offset != null) {
      issues.push(
        issue(
          IMSLP_TRANSPORT_ISSUE_CODES.invalidCursor,
          "IMSLP list transport received a cursor without a finite offset.",
          "warning",
          {
            strategy: cursor.strategy,
            offset: cursor.offset ?? null,
            batchSize: cursor.batchSize ?? null,
            sort: cursor.sort ?? null,
            sourceEntityKind: cursor.sourceEntityKind ?? null,
          },
        ),
      );
    }

    return { offset: 0, issues };
  }

  return { offset: Math.max(0, Math.trunc(cursor.offset)), issues };
}

function normalizeBatchSize(batchSize: number | undefined): {
  batchSize: number;
  issues: IngestIssue[];
} {
  if (!isFiniteInteger(batchSize)) {
    return { batchSize: IMSLP_DEFAULT_BATCH_SIZE, issues: [] };
  }

  if (batchSize <= 0) {
    return {
      batchSize: IMSLP_DEFAULT_BATCH_SIZE,
      issues: [
        issue(
          IMSLP_TRANSPORT_ISSUE_CODES.invalidBatchSize,
          "IMSLP list transport requires a positive batch size.",
          "warning",
          { batchSize },
        ),
      ],
    };
  }

  return { batchSize: Math.trunc(batchSize), issues: [] };
}

function buildImslpListUrl(start: number, limit: number, type: number): string {
  const query =
    `account=${IMSLP_LIST_ACCOUNT}` +
    `/disclaimer=${IMSLP_LIST_DISCLAIMER}` +
    `/sort=${IMSLP_LIST_SORT}` +
    `/type=${type}` +
    `/limit=${limit}` +
    `/start=${start}` +
    `/retformat=${IMSLP_LIST_RETFORMAT}`;

  return `${IMSLP_API_ORIGIN}${IMSLP_LIST_API_PATH}?${query}`;
}

function normalizeImslpListResponse(payload: unknown): NormalizedImslpListResponse {
  if (Array.isArray(payload)) {
    return {
      items: payload.filter(isImslpListRecord),
      meta: null,
    };
  }

  if (!isRecord(payload)) {
    return {
      items: [],
      meta: null,
    };
  }

  const items: ImslpListRecord[] = [];
  let meta: ImslpListMeta | null = null;

  for (const [key, value] of Object.entries(payload)) {
    if (isImslpListRecord(value)) {
      items.push(value);
      continue;
    }

    if (key === "start" || key === "limit" || key === "timestamp" || key === "apiversion") {
      continue;
    }

    if (key === "sortby" || key === "sortdirection" || key === "moreresultsavailable") {
      continue;
    }

    if (
      isRecord(value) &&
      ("start" in value ||
        "limit" in value ||
        "sortby" in value ||
        "sortdirection" in value ||
        "moreresultsavailable" in value ||
        "timestamp" in value ||
        "apiversion" in value)
    ) {
      meta = {
        start: isFiniteInteger(value.start) ? value.start : undefined,
        limit: isFiniteInteger(value.limit) ? value.limit : undefined,
        sortby: typeof value.sortby === "string" ? value.sortby : undefined,
        sortdirection: typeof value.sortdirection === "string" ? value.sortdirection : undefined,
        moreresultsavailable:
          typeof value.moreresultsavailable === "boolean"
            ? value.moreresultsavailable
            : undefined,
        timestamp: isFiniteInteger(value.timestamp) ? value.timestamp : undefined,
        apiversion: isFiniteInteger(value.apiversion) ? value.apiversion : undefined,
      };
    }
  }

  return { items, meta };
}

function isImslpListRecord(value: unknown): value is ImslpListRecord {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.type === "string" &&
    typeof value.parent === "string" &&
    "intvals" in value &&
    typeof value.permlink === "string"
  );
}

async function readResponseText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

function parseJson(text: string): { ok: true; value: unknown } | { ok: false; error: Error } {
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error : new Error("Failed to parse JSON response."),
    };
  }
}

function buildFailureIssues(
  code: string,
  message: string,
  metadata?: JsonObject,
): IngestIssue[] {
  return [issue(code, message, "error", metadata)];
}

function getListEntityKindIssue(
  type: number,
  entityKind: IngestEntityKind,
  supportedEntityKind: IngestEntityKind,
): IngestIssue {
  return issue(
    IMSLP_TRANSPORT_ISSUE_CODES.unsupportedEntityKind,
    `IMSLP type=${type} list transport only supports ${supportedEntityKind} batches for now.`,
    "error",
    { entityKind },
  );
}

async function fetchImslpListBatch(
  args: FetchBatchArgs,
  type: number,
  supportedEntityKind: IngestEntityKind,
  sourceEntityKind: "person" | "work",
): Promise<FetchBatchResult<ImslpListRecord>> {
  if (args.entityKind !== supportedEntityKind) {
    return {
      items: [],
      issues: [getListEntityKindIssue(type, args.entityKind, supportedEntityKind)],
    };
  }

  const cursor = normalizeCursor(args.cursor);
  const batchSize = normalizeBatchSize(args.batchSize);
  const issues = [...cursor.issues, ...batchSize.issues];

  const url = buildImslpListUrl(cursor.offset, batchSize.batchSize, type);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: {
        accept: "application/json,text/plain;q=0.9,*/*;q=0.8",
      },
    });
  } catch (error) {
    return {
      items: [],
      issues: [
        ...issues,
        ...buildFailureIssues(
          IMSLP_TRANSPORT_ISSUE_CODES.requestFailed,
          error instanceof Error ? error.message : "Failed to reach IMSLP list API.",
          {
            url,
            cause: error instanceof Error ? error.name : typeof error,
          },
        ),
      ],
    };
  }

  const bodyText = await readResponseText(response);

  if (!response.ok) {
    return {
      items: [],
      issues: [
        ...issues,
        ...buildFailureIssues(IMSLP_TRANSPORT_ISSUE_CODES.httpError, "IMSLP list API returned a non-success response.", {
          url,
          status: response.status,
          statusText: response.statusText,
          bodyText: bodyText.slice(0, 500),
        }),
      ],
    };
  }

  const parsed = parseJson(bodyText);
  if (!parsed.ok) {
    return {
      items: [],
      issues: [
        ...issues,
        ...buildFailureIssues(
          IMSLP_TRANSPORT_ISSUE_CODES.invalidJson,
          "IMSLP list API returned invalid JSON.",
          {
            url,
            bodyText: bodyText.slice(0, 500),
            parseError: parsed.error.message,
          },
        ),
      ],
    };
  }

  const normalized = normalizeImslpListResponse(parsed.value);
  if (!normalized.items.length && !normalized.meta) {
    return {
      items: [],
      issues: [
        ...issues,
        ...buildFailureIssues(
          IMSLP_TRANSPORT_ISSUE_CODES.invalidPayload,
          "IMSLP list API returned a payload without list records.",
          { url },
        ),
      ],
    };
  }

  const nextOffset = normalized.meta?.moreresultsavailable
    ? normalized.meta.start != null && normalized.meta.limit != null
      ? normalized.meta.start + normalized.meta.limit
      : cursor.offset + batchSize.batchSize
    : null;

  return {
    items: normalized.items,
    nextCursor:
      nextOffset == null
        ? null
        : {
            version: IMSLP_CURSOR_VERSION,
            strategy: "offset",
            offset: nextOffset,
            batchSize: normalized.meta?.limit ?? batchSize.batchSize,
            sort: IMSLP_LIST_SORT,
            sourceEntityKind,
          },
    issues,
  };
}

export async function fetchImslpType1Batch(
  args: FetchBatchArgs,
): Promise<FetchBatchResult<ImslpListRecord>> {
  return fetchImslpListBatch(args, IMSLP_LIST_TYPE_PEOPLE, "composer", "person");
}

export async function fetchImslpType2Batch(
  args: FetchBatchArgs,
): Promise<FetchBatchResult<ImslpListRecord>> {
  return fetchImslpListBatch(args, IMSLP_LIST_TYPE_WORKS, "work", "work");
}
