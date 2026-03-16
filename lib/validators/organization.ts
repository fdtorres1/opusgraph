// lib/validators/organization.ts
import { z } from "zod";

export const OrganizationPayload = z.object({
  name: z.string().min(1, "Organization name is required"),
  type: z.enum(["orchestra", "choir", "band", "church", "school", "other"]),
});

export type OrganizationPayloadType = z.infer<typeof OrganizationPayload>;
