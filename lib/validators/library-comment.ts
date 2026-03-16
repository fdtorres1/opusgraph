// lib/validators/library-comment.ts
import { z } from "zod";

export const LibraryCommentPayload = z.object({
  body: z.string().min(1, "Comment body is required"),
  parent_comment_id: z.string().uuid().nullable().optional(),
});

export type LibraryCommentPayloadType = z.infer<typeof LibraryCommentPayload>;
