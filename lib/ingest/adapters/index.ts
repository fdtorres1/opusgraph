import type { IngestAdapterRegistry } from "@/lib/ingest/jobs";

import { imslpAdapter } from "./imslp";

export const ingestAdapterRegistry: IngestAdapterRegistry = {
  imslp: imslpAdapter,
};

export * from "./types";
export * from "./imslp";
