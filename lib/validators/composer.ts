// lib/validators/composer.ts
import { z } from "zod";

export const Year = z
  .string()
  .regex(/^\d{4}$/, "Use 4 digits")
  .transform((y) => parseInt(y, 10))
  .refine((y) => y >= 1000 && y <= 2100, "Year out of range");

export const ComposerPayload = z.object({
  first_name: z.string().optional().nullable(),
  last_name: z.string().optional().nullable(),
  birth_year: z.string().optional().nullable(),
  birth_place_id: z.string().uuid().optional().nullable(),
  death_year: z.string().optional().nullable(),
  death_place_id: z.string().uuid().optional().nullable(),
  gender_id: z.string().uuid().optional().nullable(),
  gender_self_describe: z.string().optional().nullable(),
  status: z.enum(["draft", "published"]).optional(),
  nationalities: z.array(z.string().length(2)).optional(), // ISO2 country codes
  links: z.array(z.object({
    id: z.string().uuid().optional(),
    url: z.string().url(),
    is_primary: z.boolean().optional(),
    display_order: z.number().int().nonnegative().optional(),
  })).optional(),
});

export type ComposerPayloadType = z.infer<typeof ComposerPayload>;

