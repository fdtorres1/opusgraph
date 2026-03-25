import type { IngestAdapterRegistry } from "@/lib/ingest/jobs";

import { imslpComposerAdapter } from "./imslp";

export const ingestAdapterRegistry: IngestAdapterRegistry = {
  imslp: imslpComposerAdapter,
};

export * from "./types";
export * from "./imslp";
