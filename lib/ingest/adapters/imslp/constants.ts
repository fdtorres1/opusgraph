export const IMSLP_API_ORIGIN = "https://imslp.org";
export const IMSLP_LIST_API_PATH = "/imslpscripts/API.ISCR.php";

export const IMSLP_LIST_ACCOUNT = "worklist";
export const IMSLP_LIST_DISCLAIMER = "accepted";
export const IMSLP_LIST_SORT = "id";
export const IMSLP_LIST_RETFORMAT = "json";

export const IMSLP_LIST_TYPE_PEOPLE = 1 as const;
export const IMSLP_LIST_TYPE_WORKS = 2 as const;

export const IMSLP_SOURCE_ENTITY_KIND_PERSON = "person" as const;
export const IMSLP_SOURCE_ENTITY_KIND_WORK = "work" as const;

export const IMSLP_CURSOR_VERSION = 1 as const;
export const IMSLP_DEFAULT_BATCH_SIZE = 100;

export const IMSLP_TRANSPORT_ISSUE_CODES = {
  unsupportedEntityKind: "imslp_unsupported_entity_kind",
  invalidCursor: "imslp_invalid_cursor",
  invalidBatchSize: "imslp_invalid_batch_size",
  requestFailed: "imslp_request_failed",
  httpError: "imslp_http_error",
  invalidJson: "imslp_invalid_json",
  invalidPayload: "imslp_invalid_payload",
} as const;
