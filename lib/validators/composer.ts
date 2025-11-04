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
  nationality: z.string().length(2).optional().nullable(), // ISO2 country code (single country)
  links: z.array(z.object({
    id: z.string().uuid().optional(),
    url: z.string().url(),
    is_primary: z.boolean().optional(),
    display_order: z.number().int().nonnegative().optional(),
  })).optional(),
}).refine(
  (data) => {
    const firstName = data.first_name?.trim() || "";
    const lastName = data.last_name?.trim() || "";
    return firstName.length > 0 || lastName.length > 0;
  },
  {
    message: "At least one of first_name or last_name must be provided",
    path: ["first_name"], // Error shows on first_name field
  }
);

export type ComposerPayloadType = z.infer<typeof ComposerPayload>;

