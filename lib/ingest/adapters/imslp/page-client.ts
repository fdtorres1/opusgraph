import type { IngestIssue, JsonObject } from "@/lib/ingest/domain";

import { IMSLP_API_ORIGIN } from "./constants";

export interface ImslpWorkPageRequest {
  title?: string;
  pageId?: number;
  signal?: AbortSignal;
}

export interface ImslpWorkPageMetadata {
  pageId: number;
  title: string;
  touched: string | null;
  lastRevid: number | null;
  length: number | null;
  displayTitle: string | null;
  redirectTitle: string | null;
  normalizedTitle: string | null;
}

export interface ImslpWorkPageRecord {
  metadata: ImslpWorkPageMetadata;
  wikitext: string;
  issues: IngestIssue[];
}

interface ImslpQueryPage {
  pageid?: unknown;
  title?: unknown;
  touched?: unknown;
  lastrevid?: unknown;
  length?: unknown;
  redirect?: unknown;
  revisions?: unknown;
  displaytitle?: unknown;
}

interface ImslpQueryResponse {
  query?: {
    normalized?: Array<{ from?: unknown; to?: unknown }>;
    redirects?: Array<{ from?: unknown; to?: unknown }>;
    pages?: ImslpQueryPage[] | Record<string, ImslpQueryPage>;
  };
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

function toTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.trunc(value)
    : null;
}

function getPageIdentifier(input: ImslpWorkPageRequest): { title?: string; pageId?: number } {
  const title = toTrimmedString(input.title);
  if (title) {
    return { title };
  }

  if (typeof input.pageId === "number" && Number.isFinite(input.pageId)) {
    return { pageId: Math.trunc(input.pageId) };
  }

  return {};
}

function buildImslpWorkPageUrl(input: ImslpWorkPageRequest): URL | null {
  const identifier = getPageIdentifier(input);
  if (!identifier.title && identifier.pageId == null) {
    return null;
  }

  const url = new URL("/api.php", IMSLP_API_ORIGIN);
  url.searchParams.set("action", "query");
  url.searchParams.set("format", "json");
  url.searchParams.set("formatversion", "2");
  url.searchParams.set("prop", "info|revisions");
  url.searchParams.set("inprop", "displaytitle");
  url.searchParams.set("rvprop", "content");
  url.searchParams.set("rvslots", "main");
  url.searchParams.set("redirects", "1");

  if (identifier.title) {
    url.searchParams.set("titles", identifier.title);
  } else if (identifier.pageId != null) {
    url.searchParams.set("pageids", String(identifier.pageId));
  }

  return url;
}

function normalizeRevisionContent(revisions: unknown): string {
  if (!Array.isArray(revisions) || revisions.length === 0) {
    return "";
  }

  const revision = revisions[0];
  if (!isRecord(revision)) {
    return "";
  }

  const directContent = revision["*"];
  const directText = toTrimmedString(directContent);
  if (directText != null) {
    return directText;
  }

  const slots = revision.slots;
  if (!isRecord(slots)) {
    return "";
  }

  const mainSlot = slots.main;
  if (!isRecord(mainSlot)) {
    return "";
  }

  const content = toTrimmedString(mainSlot.content);
  return content ?? "";
}

function normalizePageRecord(page: ImslpQueryPage): ImslpWorkPageRecord | null {
  const pageId = toFiniteNumber(page.pageid);
  const title = toTrimmedString(page.title);

  if (pageId == null || !title) {
    return null;
  }

  const issues: IngestIssue[] = [];
  const wikitext = normalizeRevisionContent(page.revisions);

  if (!wikitext) {
    issues.push(
      issue(
        "imslp_work_page_missing_wikitext",
        "IMSLP work page metadata was returned without revision wikitext.",
        "warning",
        { pageId, title },
      ),
    );
  }

  return {
    metadata: {
      pageId,
      title,
      touched: toTrimmedString(page.touched),
      lastRevid: toFiniteNumber(page.lastrevid),
      length: toFiniteNumber(page.length),
      displayTitle: toTrimmedString(page.displaytitle),
      redirectTitle: page.redirect === "" ? null : toTrimmedString(page.redirect),
      normalizedTitle: null,
    },
    wikitext,
    issues,
  };
}

export async function fetchImslpWorkPage(
  input: ImslpWorkPageRequest,
): Promise<ImslpWorkPageRecord> {
  const url = buildImslpWorkPageUrl(input);
  if (!url) {
    return {
      metadata: {
        pageId: -1,
        title: "",
        touched: null,
        lastRevid: null,
        length: null,
        displayTitle: null,
        redirectTitle: null,
        normalizedTitle: null,
      },
      wikitext: "",
      issues: [
        issue(
          "imslp_work_page_missing_identifier",
          "An IMSLP work page request needs a title or pageId.",
          "error",
        ),
      ],
    };
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: {
        accept: "application/json",
      },
      signal: input.signal,
    });
  } catch (error) {
    return {
      metadata: {
        pageId: -1,
        title: "",
        touched: null,
        lastRevid: null,
        length: null,
        displayTitle: null,
        redirectTitle: null,
        normalizedTitle: null,
      },
      wikitext: "",
      issues: [
        issue(
          "imslp_work_page_request_failed",
          "Failed to fetch IMSLP work page metadata.",
          "error",
          { message: error instanceof Error ? error.message : String(error) },
        ),
      ],
    };
  }

  const bodyText = await response.text();
  if (!response.ok) {
    return {
      metadata: {
        pageId: -1,
        title: "",
        touched: null,
        lastRevid: null,
        length: null,
        displayTitle: null,
        redirectTitle: null,
        normalizedTitle: null,
      },
      wikitext: "",
      issues: [
        issue(
          "imslp_work_page_http_error",
          `IMSLP work page request failed with HTTP ${response.status}.`,
          "error",
          {
            status: response.status,
            statusText: response.statusText,
            bodyText: bodyText.slice(0, 500),
          },
        ),
      ],
    };
  }

  let payload: unknown;
  try {
    payload = JSON.parse(bodyText) as unknown;
  } catch (error) {
    return {
      metadata: {
        pageId: -1,
        title: "",
        touched: null,
        lastRevid: null,
        length: null,
        displayTitle: null,
        redirectTitle: null,
        normalizedTitle: null,
      },
      wikitext: "",
      issues: [
        issue(
          "imslp_work_page_invalid_json",
          "IMSLP work page request returned invalid JSON.",
          "error",
          {
            message: error instanceof Error ? error.message : String(error),
            bodyText: bodyText.slice(0, 500),
          },
        ),
      ],
    };
  }

  if (!isRecord(payload) || !isRecord(payload.query)) {
    return {
      metadata: {
        pageId: -1,
        title: "",
        touched: null,
        lastRevid: null,
        length: null,
        displayTitle: null,
        redirectTitle: null,
        normalizedTitle: null,
      },
      wikitext: "",
      issues: [
        issue(
          "imslp_work_page_invalid_payload",
          "IMSLP work page response did not include a query payload.",
          "error",
          { bodyText: bodyText.slice(0, 500) },
        ),
      ],
    };
  }

  const query = payload.query as NonNullable<ImslpQueryResponse["query"]>;
  const normalizedTitle = Array.isArray(query.normalized) && query.normalized.length > 0
    ? toTrimmedString(query.normalized[0]?.to)
    : null;

  const redirectTitle = Array.isArray(query.redirects) && query.redirects.length > 0
    ? toTrimmedString(query.redirects[0]?.to)
    : null;

  const pages = query.pages;
  const pageList = Array.isArray(pages)
    ? pages
    : isRecord(pages)
      ? Object.values(pages)
      : [];

  if (pageList.length === 0) {
    return {
      metadata: {
        pageId: -1,
        title: "",
        touched: null,
        lastRevid: null,
        length: null,
        displayTitle: null,
        redirectTitle: null,
        normalizedTitle,
      },
      wikitext: "",
      issues: [
        issue(
          "imslp_work_page_not_found",
          "IMSLP work page request returned no pages.",
          "error",
          {
            requestedTitle: input.title ?? null,
            requestedPageId: input.pageId ?? null,
          },
        ),
      ],
    };
  }

  const record = normalizePageRecord(pageList[0]);
  if (!record) {
    return {
      metadata: {
        pageId: -1,
        title: "",
        touched: null,
        lastRevid: null,
        length: null,
        displayTitle: null,
        redirectTitle: null,
        normalizedTitle,
      },
      wikitext: "",
      issues: [
        issue(
          "imslp_work_page_invalid_payload",
          "IMSLP work page response did not contain a usable page record.",
          "error",
          { bodyText: bodyText.slice(0, 500) },
        ),
      ],
    };
  }

  record.metadata.normalizedTitle = normalizedTitle;
  if (redirectTitle) {
    record.metadata.redirectTitle = redirectTitle;
  }

  return {
    ...record,
    issues: [
      ...record.issues,
      ...(normalizedTitle
        ? [
            issue(
              "imslp_work_page_normalized_title",
              "IMSLP work page title was normalized by MediaWiki.",
              "warning",
              {
                requestedTitle: input.title ?? null,
                normalizedTitle,
              },
            ),
          ]
        : []),
      ...(redirectTitle
        ? [
            issue(
              "imslp_work_page_redirected",
              "IMSLP work page request resolved through a redirect.",
              "warning",
              {
                requestedTitle: input.title ?? null,
                redirectTitle,
              },
            ),
          ]
        : []),
    ],
  };
}
