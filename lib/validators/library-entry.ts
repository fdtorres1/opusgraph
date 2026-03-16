// lib/validators/library-entry.ts
import { z } from "zod";

export const LibraryEntryOverrides = z.object({
  title: z.string().optional(),
  composer_first_name: z.string().optional(),
  composer_last_name: z.string().optional(),
  arranger: z.string().optional(),
  publisher: z.string().optional(),
  instrumentation: z.string().optional(),
  duration: z.number().int().nonnegative().optional(), // seconds
  year_composed: z.number().int().min(1000).max(2100).optional(),
});

export const LibraryEntryPart = z.object({
  id: z.string().uuid().optional(), // present when editing existing
  part_name: z.string().min(1, "Part name is required"),
  quantity: z.number().int().nonnegative().default(1),
  condition: z.enum(["excellent", "good", "fair", "poor", "missing"]).nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const LibraryEntryPayload = z.object({
  reference_work_id: z.string().uuid().nullable().optional(),
  overrides: LibraryEntryOverrides.default({}),
  copies_owned: z.number().int().nonnegative().default(0),
  location: z.string().nullable().optional(),
  condition: z.enum(["excellent", "good", "fair", "poor", "missing"]).nullable().optional(),
  notes: z.string().nullable().optional(),
  parts: z.array(LibraryEntryPart).optional(),
});

export type LibraryEntryOverridesType = z.infer<typeof LibraryEntryOverrides>;
export type LibraryEntryPartType = z.infer<typeof LibraryEntryPart>;
export type LibraryEntryPayloadType = z.infer<typeof LibraryEntryPayload>;
