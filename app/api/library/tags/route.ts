// app/api/library/tags/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { LibraryTagPayload } from "@/lib/validators/library-tag";
import { z } from "zod";

const OrgId = z.string().uuid();

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const organizationId = req.nextUrl.searchParams.get("organization_id");

  if (!organizationId || !OrgId.safeParse(organizationId).success) {
    return NextResponse.json(
      { error: "Valid organization_id is required" },
      { status: 400 }
    );
  }

  // Verify user is a member of this org
  const { data: membership } = await supabase
    .from("org_member")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Fetch tags with entry counts
  const { data: tags, error } = await supabase
    .from("library_tag")
    .select("id, name, category, color, library_entry_tag(count)")
    .eq("organization_id", organizationId)
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Flatten the count from the nested aggregate
  const result = (tags ?? []).map((tag) => ({
    id: tag.id,
    name: tag.name,
    category: tag.category,
    color: tag.color,
    entry_count:
      Array.isArray(tag.library_entry_tag) && tag.library_entry_tag.length > 0
        ? (tag.library_entry_tag[0] as { count: number }).count
        : 0,
  }));

  return NextResponse.json({ tags: result });
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { organization_id } = body;

  if (!organization_id) {
    return NextResponse.json(
      { error: "organization_id is required" },
      { status: 400 }
    );
  }

  // Verify user is manager or owner
  const { data: membership } = await supabase
    .from("org_member")
    .select("role")
    .eq("organization_id", organization_id)
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

  // Validate tag payload
  const parsed = LibraryTagPayload.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const p = parsed.data;

  const { data: tag, error } = await supabase
    .from("library_tag")
    .insert({
      organization_id,
      name: p.name,
      category: p.category ?? null,
      color: p.color ?? null,
    })
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

  return NextResponse.json({ ok: true, tag });
}
