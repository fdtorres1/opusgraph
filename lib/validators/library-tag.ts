// lib/validators/library-tag.ts
import { z } from "zod";

export const LibraryTagPayload = z.object({
  name: z.string().min(1, "Tag name is required"),
  category: z.string().nullable().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color must be a hex color code").nullable().optional(),
});

export type LibraryTagPayloadType = z.infer<typeof LibraryTagPayload>;
