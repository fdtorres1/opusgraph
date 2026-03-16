// app/api/library/activity/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);

  const organizationId = searchParams.get("organization_id");
  if (!organizationId) {
    return NextResponse.json(
      { error: "organization_id is required" },
      { status: 400 }
    );
  }

  // Verify user is a member of this organization (any role is sufficient)
  const { data: membership } = await supabase
    .from("org_member")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    return NextResponse.json(
      { error: "Not a member of this organization" },
      { status: 403 }
    );
  }

  const limit = parseInt(searchParams.get("limit") || "50");
  const offset = parseInt(searchParams.get("offset") || "0");
  const source = searchParams.get("source"); // 'revision', 'comment', 'review_flag', or null for all
  const entityType = searchParams.get("entity_type"); // 'library_entry', 'performance', 'organization', etc., or null for all

  let query = supabase
    .from("activity_event")
    .select("*")
    .eq("organization_id", organizationId)
    .order("occurred_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (source) {
    query = query.eq("source", source);
  }

  if (entityType) {
    query = query.eq("entity_type", entityType);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ events: data ?? [] });
}
