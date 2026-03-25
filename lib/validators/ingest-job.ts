import { z } from "zod";

import type { JsonObject, JsonValue } from "@/lib/ingest/domain";

const jsonValue: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(jsonValue), jsonObject]),
);

const jsonObject: z.ZodType<JsonObject> = z.record(z.string(), jsonValue);

const IngestCursorSchema = z.object({
  version: z.int(),
  strategy: z.string().trim().min(1),
  offset: z.int().optional(),
  batchSize: z.int().positive().optional(),
  sort: z.string().optional(),
  sourceEntityKind: z.string().optional(),
  state: jsonObject.optional(),
});

export const IngestJobIdParams = z.object({
  id: z.uuid(),
});

export const CreateIngestJobBody = z.object({
  source: z.string().trim().min(1),
  entityKind: z.enum(["composer", "work"]),
  mode: z.enum(["manual", "scheduled", "backfill", "retry"]).default("manual"),
  dryRun: z.boolean().default(false),
  options: jsonObject.optional(),
  cursor: IngestCursorSchema.optional().nullable(),
  batchSize: z.int().positive().optional(),
  limitCount: z.int().positive().optional(),
  priority: z.int().nonnegative().optional(),
});

export const RunIngestJobBatchBody = z
  .object({
    workerIdentity: z.string().trim().min(1).max(120).optional(),
    defaultBatchSize: z.int().positive().optional(),
  })
  .default({});
