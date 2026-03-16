// app/api/library/entries/[id]/tags/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { z } from "zod";

const Id = z.string().uuid();
const TagIdsPayload = z.object({
  tag_ids: z.array(z.string().uuid()),
});

export async function PUT(
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

  // Fetch entry to get its organization_id
  const { data: entry } = await supabase
    .from("library_entry")
    .select("organization_id")
    .eq("id", id)
    .single();

  if (!entry) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Verify user is manager or owner
  const { data: membership } = await supabase
    .from("org_member")
    .select("role")
    .eq("organization_id", entry.organization_id)
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
  const parsed = TagIdsPayload.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { tag_ids } = parsed.data;

  // Delete all existing tag assignments for this entry
  const { error: deleteError } = await supabase
    .from("library_entry_tag")
    .delete()
    .eq("library_entry_id", id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 400 });
  }

  // Insert new tag assignments
  if (tag_ids.length > 0) {
    const { error: insertError } = await supabase
      .from("library_entry_tag")
      .insert(
        tag_ids.map((tag_id) => ({
          library_entry_id: id,
          library_tag_id: tag_id,
        }))
      );

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message },
        { status: 400 }
      );
    }
  }

  return NextResponse.json({ ok: true });
}
