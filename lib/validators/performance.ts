// lib/validators/performance.ts
import { z } from "zod";

export const PerformanceWork = z.object({
  library_entry_id: z.string().uuid(),
  program_order: z.number().int().nonnegative(),
  notes: z.string().nullable().optional(),
});

export const PerformancePayload = z.object({
  date: z.string(), // ISO date string YYYY-MM-DD
  event_name: z.string().min(1, "Event name is required"),
  venue: z.string().nullable().optional(),
  season: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  works: z.array(PerformanceWork).optional(),
});

export type PerformanceWorkType = z.infer<typeof PerformanceWork>;
export type PerformancePayloadType = z.infer<typeof PerformancePayload>;
