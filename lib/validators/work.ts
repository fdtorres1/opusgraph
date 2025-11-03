// lib/validators/work.ts
import { z } from "zod";

export const Year = z
  .string()
  .regex(/^\d{4}$/, "Use 4 digits")
  .transform((y) => parseInt(y, 10))
  .refine((y) => y >= 1000 && y <= 2100, "Year out of range");

export const Duration = z
  .string()
  .regex(/^(\d{1,2}:)?\d{1,2}:\d{2}$/, "Use MM:SS or HH:MM:SS")
  .transform((s) => {
    const parts = s.split(":").map(Number);
    return parts.length === 2 ? parts[0] * 60 + parts[1] : parts[0] * 3600 + parts[1] * 60 + parts[2];
  });

export const WorkPayload = z.object({
  work_name: z.string().optional().nullable(),
  composition_year: z.string().optional().nullable(),
  composer_id: z.string().uuid().optional().nullable(),
  ensemble_id: z.string().uuid().optional().nullable(),
  instrumentation_text: z.string().optional().nullable(),
  duration: z.string().optional().nullable(), // UI only; convert to seconds server-side
  publisher_id: z.string().uuid().optional().nullable(),
  status: z.enum(["draft", "published"]).optional(),
  sources: z.array(z.object({
    id: z.string().uuid().optional(),
    url: z.string().url(),
    title: z.string().optional().nullable(),
    display_order: z.number().int().nonnegative().optional(),
  })).optional(),
  recordings: z.array(z.object({
    id: z.string().uuid().optional(),
    url: z.string().url(),
    display_order: z.number().int().nonnegative().optional(),
  })).optional(),
});

export type WorkPayloadType = z.infer<typeof WorkPayload>;

