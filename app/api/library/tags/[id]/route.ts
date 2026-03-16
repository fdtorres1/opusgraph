// app/api/library/tags/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { LibraryTagPayload } from "@/lib/validators/library-tag";
import { z } from "zod";

const Id = z.string().uuid();

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    Id.parse(id);
  } catch {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  // Fetch the tag to get its organization_id
  const { data: tag } = await supabase
    .from("library_tag")
    .select("organization_id")
    .eq("id", id)
    .single();

  if (!tag) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Verify user is manager or owner
  const { data: membership } = await supabase
    .from("org_member")
    .select("role")
    .eq("organization_id", tag.organization_id)
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!["owner", "manager"].includes(membership.role)) {
    return NextResponse.json(
      { error: "Insufficient role for this action" },
      { status: 403 }
    );
  }

  // Validate request body
  const body = await req.json();
  const parsed = LibraryTagPayload.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const p = parsed.data;

  const { data: updated, error } = await supabase
    .from("library_tag")
    .update({
      name: p.name,
      category: p.category ?? null,
      color: p.color ?? null,
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    // Unique constraint violation (duplicate tag name within org)
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "A tag with this name already exists in this organization" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, tag: updated });
}

export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    Id.parse(id);
  } catch {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  // Fetch the tag to get its organization_id
  const { data: tag } = await supabase
    .from("library_tag")
    .select("organization_id")
    .eq("id", id)
    .single();

  if (!tag) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Verify user is manager or owner
  const { data: membership } = await supabase
    .from("org_member")
    .select("role")
    .eq("organization_id", tag.organization_id)
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!["owner", "manager"].includes(membership.role)) {
    return NextResponse.json(
      { error: "Insufficient role for this action" },
      { status: 403 }
    );
  }

  // Delete tag (cascade removes library_entry_tag rows)
  const { error } = await supabase
    .from("library_tag")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, message: "Tag deleted" });
}
