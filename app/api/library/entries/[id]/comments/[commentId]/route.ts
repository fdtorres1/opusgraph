// app/api/library/entries/[id]/comments/[commentId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { z } from "zod";

const Id = z.string().uuid();

const UpdateCommentPayload = z.object({
  body: z.string().min(1, "Comment body is required"),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  const supabase = await createServerSupabase();
  const { id: entryId, commentId } = await params;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    Id.parse(entryId);
    Id.parse(commentId);
  } catch {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  // Fetch the comment and verify it belongs to this entry
  const { data: comment, error: commentError } = await supabase
    .from("library_comment")
    .select("*")
    .eq("id", commentId)
    .eq("library_entry_id", entryId)
    .single();

  if (commentError || !comment) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }

  // Verify the user is the comment author
  if (comment.author_user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Validate request body
  const body = await req.json();
  const parsed = UpdateCommentPayload.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Update the comment body
  const { data: updated, error: updateError } = await supabase
    .from("library_comment")
    .update({ body: parsed.data.body })
    .eq("id", commentId)
    .select("*")
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, comment: updated });
}

export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  const supabase = await createServerSupabase();
  const { id: entryId, commentId } = await params;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    Id.parse(entryId);
    Id.parse(commentId);
  } catch {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  // Fetch the comment and verify it belongs to this entry
  const { data: comment, error: commentError } = await supabase
    .from("library_comment")
    .select("*")
    .eq("id", commentId)
    .eq("library_entry_id", entryId)
    .single();

  if (commentError || !comment) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }

  // Verify the user is the comment author
  if (comment.author_user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Delete the comment (cascade handles child replies)
  const { error: deleteError } = await supabase
    .from("library_comment")
    .delete()
    .eq("id", commentId);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, message: "Comment deleted" });
}
