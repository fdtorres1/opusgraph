// app/api/library/entries/[id]/comments/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { LibraryCommentPayload } from "@/lib/validators/library-comment";
import { z } from "zod";

const Id = z.string().uuid();

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerSupabase();
  const { id: entryId } = await params;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch entry to get organization_id
  const { data: entry, error: entryError } = await supabase
    .from("library_entry")
    .select("organization_id")
    .eq("id", entryId)
    .single();

  if (entryError || !entry) {
    return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  }

  // Verify user is an org member (any role)
  const { data: membership } = await supabase
    .from("org_member")
    .select("role")
    .eq("organization_id", entry.organization_id)
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Fetch comments with author info, ordered oldest-first for threading
  const { data: comments, error: commentsError } = await supabase
    .from("library_comment")
    .select(
      `
      id,
      body,
      parent_comment_id,
      created_at,
      author_user_id
    `
    )
    .eq("library_entry_id", entryId)
    .order("created_at", { ascending: true });

  if (commentsError) {
    return NextResponse.json(
      { error: commentsError.message },
      { status: 500 }
    );
  }

  // Collect unique author IDs and fetch profiles
  const authorIds = [...new Set(comments.map((c) => c.author_user_id))];

  const profileMap: Record<
    string,
    { first_name: string | null; last_name: string | null }
  > = {};

  if (authorIds.length > 0) {
    const { data: profiles } = await supabase
      .from("user_profile")
      .select("user_id, first_name, last_name")
      .in("user_id", authorIds);

    if (profiles) {
      for (const p of profiles) {
        profileMap[p.user_id] = {
          first_name: p.first_name,
          last_name: p.last_name,
        };
      }
    }
  }

  // Shape response with nested author object
  const shaped = comments.map((c) => ({
    id: c.id,
    body: c.body,
    parent_comment_id: c.parent_comment_id,
    created_at: c.created_at,
    author: {
      user_id: c.author_user_id,
      first_name: profileMap[c.author_user_id]?.first_name ?? null,
      last_name: profileMap[c.author_user_id]?.last_name ?? null,
    },
  }));

  return NextResponse.json({ comments: shaped });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerSupabase();
  const { id: entryId } = await params;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    Id.parse(entryId);
  } catch {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  // Fetch entry to get organization_id
  const { data: entry, error: entryError } = await supabase
    .from("library_entry")
    .select("organization_id")
    .eq("id", entryId)
    .single();

  if (entryError || !entry) {
    return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  }

  // Verify user is an org member (any role)
  const { data: membership } = await supabase
    .from("org_member")
    .select("role")
    .eq("organization_id", entry.organization_id)
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Validate request body
  const body = await req.json();
  const parsed = LibraryCommentPayload.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const p = parsed.data;

  // If a parent_comment_id is provided, verify it belongs to this entry
  if (p.parent_comment_id) {
    const { data: parentComment } = await supabase
      .from("library_comment")
      .select("id")
      .eq("id", p.parent_comment_id)
      .eq("library_entry_id", entryId)
      .single();

    if (!parentComment) {
      return NextResponse.json(
        { error: "Parent comment not found on this entry" },
        { status: 400 }
      );
    }
  }

  // Insert the comment
  const { data: comment, error: insertError } = await supabase
    .from("library_comment")
    .insert({
      library_entry_id: entryId,
      author_user_id: user.id,
      body: p.body,
      parent_comment_id: p.parent_comment_id ?? null,
    })
    .select("*")
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, comment }, { status: 201 });
}
