// app/api/library/entries/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

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

  // Verify user is a manager or owner for this org
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

  // Create minimal library entry
  const { data, error } = await supabase
    .from("library_entry")
    .insert({
      organization_id,
      created_by: user.id,
      overrides: {},
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Log revision
  await supabase.from("revision").insert({
    entity_type: "library_entry",
    entity_id: data.id,
    actor_user_id: user.id,
    action: "create",
    organization_id,
    snapshot: data,
  });

  return NextResponse.json({ id: data.id });
}
